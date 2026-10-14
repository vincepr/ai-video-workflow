"""Finish a frozen product-video run with a frame-based local edit plan.

Requires a full FFmpeg with drawtext, reverse and audio filters. Pass both
binary paths explicitly or set FFMPEG_PATH and FFPROBE_PATH. No provider calls.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def command(args):
    result = subprocess.run([str(arg) for arg in args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:] or result.stdout[-4000:])
    return result


def probe(binary, file):
    return json.loads(command([binary, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout)


def inside(run, name):
    if not isinstance(name, str) or not name or Path(name).is_absolute() or '\\' in name or any(part in ('', '.', '..') for part in name.split('/')):
        raise ValueError(f'Invalid local source: {name}')
    file = (run / name).resolve(strict=True)
    if not file.is_relative_to(run.resolve()) or not file.is_file():
        raise ValueError(f'Source leaves run: {name}')
    return file


def positive_int(value, label):
    if type(value) is not int or value <= 0:
        raise ValueError(f'{label} must be a positive integer')
    return value


def caption_text(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 200 or '\n' in value:
        raise ValueError('Invalid caption text')
    return value.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace('%', '\\%')


def position(value, default):
    if value is None:
        return default
    if type(value) is int:
        return str(value)
    if isinstance(value, str) and re.fullmatch(r'[0-9whtext_()/+* .-]+', value):
        return value
    raise ValueError('Invalid caption position')


def prepare(run, plan, metadata):
    if plan.get('version') != 1:
        raise ValueError('Unsupported edit-plan version')
    fps = positive_int(plan.get('fps'), 'fps')
    if fps > 120:
        raise ValueError('fps exceeds supported range')
    canvas = plan.get('canvas') or {'width': 1080, 'height': 1920, 'fit': 'contain', 'background': 'black'}
    width, height = positive_int(canvas.get('width'), 'canvas width'), positive_int(canvas.get('height'), 'canvas height')
    if width % 2 or height % 2 or width > 3840 or height > 3840:
        raise ValueError('Canvas must be even and within 3840 pixels')
    fit = canvas.get('fit', 'contain')
    if fit not in ('contain', 'cover'):
        raise ValueError('Unsupported canvas fit')
    color = canvas.get('background', 'black')
    if not isinstance(color, str) or not re.fullmatch(r'[A-Za-z]+|#[0-9a-fA-F]{6}', color):
        raise ValueError('Invalid canvas color')
    segments = plan.get('segments')
    if not isinstance(segments, list) or not segments:
        raise ValueError('Edit plan needs segments')
    sources = []
    total = 0
    for segment in segments:
        source = inside(run, segment.get('source'))
        if source not in sources:
            sources.append(source)
        kind = segment.get('kind')
        if kind == 'still':
            if source.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
                raise ValueError('Still source must be an image')
            total += positive_int(segment.get('frames'), 'still frames')
            continue
        first, last = segment.get('fromFrame'), segment.get('toFrame')
        if type(first) is not int or first < 0 or type(last) is not int or last <= first:
            raise ValueError('Invalid source frame range')
        if kind not in ('motion', 'reverse', 'repeat', 'hold'):
            raise ValueError(f'Unsupported segment kind: {kind}')
        frames = positive_int(segment.get('frames'), 'hold frames') if kind == 'hold' else last - first
        if kind == 'hold' and last - first != 1:
            raise ValueError('Hold must identify one source frame')
        total += frames
    if total > fps * 600:
        raise ValueError('Edit exceeds ten minutes')
    captions = plan.get('captions', [])
    if not isinstance(captions, list):
        raise ValueError('Captions must be a list')
    for item in captions:
        first, last = item.get('fromFrame'), item.get('toFrame')
        if type(first) is not int or type(last) is not int or first < 0 or last <= first or last > total:
            raise ValueError('Caption window is outside the edit')
        caption_text(item.get('text'))
    audio = plan.get('audio') or {'source': 'none'}
    source = audio.get('source', 'none')
    if source == 'native':
        if not any(stream.get('codec_type') == 'audio' for stream in metadata[str(sources[0])]['streams']):
            raise ValueError('Native audio is absent')
    elif source != 'none':
        inside(run, source)
    for key in ('volume', 'limit'):
        value = audio.get(key, 1.0)
        if not isinstance(value, (int, float)) or not 0 < value <= 1:
            raise ValueError(f'Invalid audio {key}')
    for key in ('fadeInFrames', 'fadeOutFrames'):
        value = audio.get(key, 0)
        if type(value) is not int or value < 0 or value > total:
            raise ValueError(f'Invalid audio {key}')
    return fps, (width, height, fit, color), sources, total, audio


def render(run, plan_file, output, ffmpeg, ffprobe):
    run = run.resolve(strict=True)
    if output.exists():
        raise ValueError('Finished output already exists')
    plan = json.loads(plan_file.read_text(encoding='utf8'))
    sources = list(dict.fromkeys(inside(run, segment.get('source')) for segment in plan.get('segments', [])))
    metadata = {str(source): probe(ffprobe, source) for source in sources}
    fps, canvas, sources, total, audio = prepare(run, plan, metadata)
    width, height, fit, color = canvas
    args = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-n']
    for source in sources:
        if source.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
            args += ['-loop', '1', '-framerate', str(fps)]
        args += ['-i', source]
    audio_source = audio.get('source', 'none')
    if audio_source not in ('none', 'native'):
        args += ['-i', inside(run, audio_source)]
    branches = []
    by_source = {source: [] for source in sources}
    for index, segment in enumerate(plan['segments']):
        by_source[inside(run, segment['source'])].append(index)
    for source_index, source in enumerate(sources):
        indexes = by_source[source]
        if len(indexes) == 1:
            branches.append(f'[{source_index}:v]fps={fps}[src{indexes[0]}]')
        else:
            targets = ''.join(f'[src{index}]' for index in indexes)
            branches.append(f'[{source_index}:v]fps={fps},split={len(indexes)}{targets}')
    for index, segment in enumerate(plan['segments']):
        kind = segment['kind']
        if kind == 'still':
            filters = ['trim=start_frame=0:end_frame=1', f'tpad=stop_mode=clone:stop={segment["frames"]-1}']
        else:
            first, last = segment['fromFrame'], segment['toFrame']
            filters = [f'trim=start_frame={first}:end_frame={last}']
        if kind == 'reverse':
            filters.append('reverse')
        if kind == 'hold':
            filters.append(f'tpad=stop_mode=clone:stop={segment["frames"]-1}')
        filters.append(f'setpts=N/({fps}*TB)')
        if fit == 'contain':
            filters += [f'scale={width}:{height}:force_original_aspect_ratio=decrease', f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color={color}']
        else:
            filters += [f'scale={width}:{height}:force_original_aspect_ratio=increase', f'crop={width}:{height}']
        filters.append('setsar=1')
        branches.append(f'[src{index}]' + ','.join(filters) + f'[seg{index}]')
    joined = ''.join(f'[seg{index}]' for index in range(len(plan['segments'])))
    branches.append(f'{joined}concat=n={len(plan["segments"])}:v=1:a=0[base]')
    video_label = 'base'
    for index, item in enumerate(plan.get('captions', [])):
        size = positive_int(item.get('fontSize', 48), 'font size')
        if size > 300:
            raise ValueError('Caption font too large')
        font_color = item.get('color', 'white')
        if not isinstance(font_color, str) or not re.fullmatch(r'[A-Za-z]+|#[0-9a-fA-F]{6}', font_color):
            raise ValueError('Invalid caption color')
        font = item.get('fontFile')
        font_option = ''
        if font:
            font_path = inside(run, font)
            escaped = str(font_path).replace('\\', '/').replace(':', '\\:').replace("'", "\\'")
            font_option = f"fontfile='{escaped}':"
        start, end = item['fromFrame'], item['toFrame']
        filter_text = caption_text(item['text'])
        x, y = position(item.get('x'), '(w-text_w)/2'), position(item.get('y'), 'h-text_h-80')
        next_label = f'cap{index}'
        branches.append(f"[{video_label}]drawtext={font_option}text='{filter_text}':fontsize={size}:fontcolor={font_color}:x={x}:y={y}:enable='between(n,{start},{end-1})'[{next_label}]")
        video_label = next_label
    duration = total / fps
    if audio_source != 'none':
        audio_index = sources.index(sources[0]) if audio_source == 'native' else len(sources)
        af = [f'atrim=duration={duration:.9f}', 'asetpts=PTS-STARTPTS', f'apad=whole_dur={duration:.9f}', f'volume={audio.get("volume",1.0)}']
        if audio.get('fadeInFrames', 0):
            af.append(f'afade=t=in:st=0:d={audio["fadeInFrames"]/fps:.9f}')
        if audio.get('fadeOutFrames', 0):
            af.append(f'afade=t=out:st={(total-audio["fadeOutFrames"])/fps:.9f}:d={audio["fadeOutFrames"]/fps:.9f}')
        af.append(f'alimiter=limit={audio.get("limit",1.0)}:level=false')
        branches.append(f'[{audio_index}:a:0]' + ','.join(af) + '[outa]')
    args += ['-filter_complex', ';'.join(branches), '-map', f'[{video_label}]']
    if audio_source != 'none':
        args += ['-map', '[outa]', '-c:a', 'aac', '-b:a', '192k']
    else:
        args += ['-an']
    args += ['-frames:v', str(total), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]
    command(args)
    result = probe(ffprobe, output)
    video = next(stream for stream in result['streams'] if stream['codec_type'] == 'video')
    if (video.get('width'), video.get('height')) != (width, height) or int(video.get('nb_frames', -1)) != total:
        raise RuntimeError('Encoded output dimensions or frame count differ from plan')
    audio_analysis = None
    if any(stream['codec_type'] == 'audio' for stream in result['streams']):
        measured = command([ffmpeg, '-hide_banner', '-i', output, '-vn', '-af', 'volumedetect,astats=metadata=1:reset=0', '-f', 'null', '-'])
        audio_analysis = measured.stderr
        (run / 'audio-analysis.txt').write_text(audio_analysis, encoding='utf8')
    report = {'version': 1, 'file': str(output), 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'frames': total, 'fps': fps, 'durationSec': duration, 'canvas': [width, height],
              'sources': [{'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()} for source in sources],
              'segments': plan['segments'], 'captions': plan.get('captions', []), 'audio': audio,
              'audioMeasuredFromEncodedOutput': audio_analysis is not None, 'probe': result}
    (run / 'finish-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'file': str(output), 'frames': total, 'fps': fps, 'canvas': [width, height], 'audioMeasuredFromEncodedOutput': audio_analysis is not None}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['render'])
    parser.add_argument('run', type=Path)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--ffmpeg', default=os.environ.get('FFMPEG_PATH') or 'ffmpeg')
    parser.add_argument('--ffprobe', default=os.environ.get('FFPROBE_PATH') or 'ffprobe')
    args = parser.parse_args()
    try:
        render(args.run, args.plan, args.output, args.ffmpeg, args.ffprobe)
    except (ValueError, RuntimeError, FileNotFoundError, KeyError) as error:
        print(f'finish: {error}', file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == '__main__':
    main()

"""Offline integration checks for the frame-based finishing command."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / '.agents/skills/generate-product-video/scripts/finish.py'
FFMPEG = os.environ.get('FFMPEG_PATH')
FFPROBE = os.environ.get('FFPROBE_PATH')


def command(*args):
    return subprocess.run([str(arg) for arg in args], check=True, capture_output=True, text=True)


@unittest.skipUnless(FFMPEG and FFPROBE, 'set FFMPEG_PATH and FFPROBE_PATH for local moving-media verification')
class FinishTest(unittest.TestCase):
    def test_still_image_hold_can_follow_motion(self):
        with tempfile.TemporaryDirectory(prefix='pv-still-') as temp:
            run = Path(temp)
            command(FFMPEG, '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30:d=1', '-c:v', 'libx264', run / 'video-raw.mp4')
            command(FFMPEG, '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90', '-frames:v', '1', run / 'hero.png')
            plan = {'version': 1, 'fps': 30, 'canvas': {'width': 160, 'height': 90},
                    'segments': [{'source': 'video-raw.mp4', 'fromFrame': 0, 'toFrame': 30, 'kind': 'motion'},
                                 {'source': 'hero.png', 'kind': 'still', 'frames': 30}],
                    'captions': [], 'audio': {'source': 'none'}}
            (run / 'edit-plan.json').write_text(json.dumps(plan), encoding='utf8')
            result = command(sys.executable, SCRIPT, 'render', run, '--plan', run / 'edit-plan.json', '--output', run / 'finished.mp4', '--ffmpeg', FFMPEG, '--ffprobe', FFPROBE)
            self.assertEqual(json.loads(result.stdout)['frames'], 60)

    def test_cuts_reverse_hold_repeat_and_caption_create_exact_frames(self):
        with tempfile.TemporaryDirectory(prefix='pv-finish-') as temp:
            run = Path(temp)
            raw = run / 'video-raw.mp4'
            command(FFMPEG, '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30:duration=2',
                    '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=2',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', raw)
            before = raw.read_bytes()
            plan = {'version': 1, 'fps': 30, 'canvas': {'width': 180, 'height': 320, 'fit': 'contain', 'background': 'black'},
                    'segments': [
                        {'source': 'video-raw.mp4', 'fromFrame': 0, 'toFrame': 30, 'kind': 'motion'},
                        {'source': 'video-raw.mp4', 'fromFrame': 30, 'toFrame': 60, 'kind': 'reverse'},
                        {'source': 'video-raw.mp4', 'fromFrame': 29, 'toFrame': 30, 'kind': 'hold', 'frames': 15},
                        {'source': 'video-raw.mp4', 'fromFrame': 0, 'toFrame': 30, 'kind': 'repeat'}],
                    'captions': [{'text': 'Sample CTA', 'fromFrame': 75, 'toFrame': 105, 'x': '(w-text_w)/2', 'y': 'h-40', 'fontSize': 18, 'color': 'white'}],
                    'audio': {'source': 'native', 'volume': 0.5, 'fadeOutFrames': 10, 'limit': 0.9}}
            (run / 'edit-plan.json').write_text(json.dumps(plan), encoding='utf8')
            output = run / 'finished.mp4'
            result = command(sys.executable, SCRIPT, 'render', run, '--plan', run / 'edit-plan.json', '--output', output,
                             '--ffmpeg', FFMPEG, '--ffprobe', FFPROBE)
            report = json.loads(result.stdout)
            self.assertEqual(report['frames'], 105)
            self.assertEqual(report['canvas'], [180, 320])
            self.assertTrue(output.is_file())
            self.assertEqual(raw.read_bytes(), before)
            streams = json.loads(command(FFPROBE, '-v', 'error', '-show_streams', '-of', 'json', output).stdout)['streams']
            video = next(stream for stream in streams if stream['codec_type'] == 'video')
            self.assertEqual((video['width'], video['height']), (180, 320))
            self.assertEqual(int(video['nb_frames']), 105)
            self.assertTrue(any(stream['codec_type'] == 'audio' for stream in streams))
            self.assertTrue((run / 'finish-report.json').is_file())
            self.assertTrue((run / 'audio-analysis.txt').is_file())


if __name__ == '__main__':
    unittest.main()

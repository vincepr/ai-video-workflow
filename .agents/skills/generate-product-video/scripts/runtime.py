"""Durable OpenRouter product-video operations. Python 3.10+, standard library only.

The input is the phase-01 frozen request envelope in RUN/request.json. Recorded
responses are explicit offline fixtures; they never load credentials or use a socket.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import os
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

BASE = 'https://openrouter.ai/api/v1'
API_HOST = 'openrouter.ai'
TERMINAL = {'completed', 'failed', 'cancelled', 'canceled', 'expired'}


def now():
    return datetime.now(timezone.utc).isoformat()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_once(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as file:
        json.dump(value, file, indent=2, ensure_ascii=False)
        file.write('\n')


def replace_json(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + '.partial')
    with temporary.open('w', encoding='utf-8') as file:
        json.dump(value, file, indent=2, ensure_ascii=False)
        file.write('\n')
    os.replace(temporary, path)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def frozen(run):
    envelope = read(run / 'request.json')
    request = envelope['request']
    if (request.get('schemaVersion') != 1 or request.get('id') != run.name or
            request.get('execution', {}).get('provider') != 'openrouter'):
        raise ValueError('Unsupported or mismatched frozen request')
    return envelope


def snapshots(run, envelope):
    files = {}
    for entry in envelope['context']['files']:
        relative = Path(entry['snapshotPath'])
        if relative.is_absolute() or '..' in relative.parts or relative.parts[0] != 'inputs':
            raise ValueError('Invalid snapshot path')
        path = run / relative
        data = path.read_bytes()
        if sha(data) != entry['sha256']:
            raise ValueError('Frozen input hash mismatch')
        files[entry['path']] = (path, data)
    return files


def payload_for(run, stage, envelope):
    request = envelope['request']
    execution = request['execution']
    files = snapshots(run, envelope)
    prompt_file = run / ('image-prompt.md' if stage == 'image' else 'video-prompt.md')
    prompt = prompt_file.read_text(encoding='utf-8').strip()
    if not prompt:
        raise ValueError('Empty prompt')
    resolution = execution.get('imageResolution', execution['resolution']) if stage == 'image' else execution['resolution']
    common = {'model': execution['models'][stage], 'prompt': prompt,
              'aspect_ratio': execution['aspectRatio'], 'resolution': resolution}
    if stage == 'image':
        refs = []
        for ref in request['references']:
            if ref['role'] not in ('product', 'presenter', 'environment'):
                raise ValueError('Reference role unsupported for first-frame generation')
            path, data = files[ref['path']]
            mime = mimetypes.guess_type(ref['path'])[0] or 'application/octet-stream'
            refs.append({'type': 'image_url', 'image_url': {'url': 'data:' + mime + ';base64,' + base64.b64encode(data).decode()}})
        if not refs:
            raise ValueError('Image generation needs references')
        return {**common, 'n': 1, 'input_references': refs}
    frame = run / 'first-frame.bin'
    data = frame.read_bytes()
    meta = read(run / 'first-frame-meta.json')
    if sha(data) != meta['sha256']:
        raise ValueError('First frame changed after acceptance')
    mime = meta.get('media_type') or 'image/png'
    return {**common, 'duration': execution['durationSec'], 'generate_audio': execution['audio'],
            'frame_images': [{'type': 'image_url', 'image_url': {'url': 'data:' + mime + ';base64,' + base64.b64encode(data).decode()},
                              'frame_type': 'first_frame'}]}


def summary(payload):
    result = {key: value for key, value in payload.items() if key not in ('input_references', 'frame_images')}
    result['reference_count'] = len(payload.get('input_references', payload.get('frame_images', [])))
    return result


def model_for(stage, request, discovery):
    kind = 'image-models' if stage == 'image' else 'video-models'
    models = discovery[kind]['data']
    model = next((item for item in models if item.get('id') == request['execution']['models'][stage]), None)
    if model is None:
        raise ValueError('Selected model absent from capability discovery')
    execution = request['execution']
    if stage == 'image':
        params = model.get('supported_parameters') or {}
        for field, value in (('aspect_ratio', execution['aspectRatio']),
                             ('resolution', execution.get('imageResolution', execution['resolution']))):
            if value not in (params.get(field) or {}).get('values', []):
                raise ValueError('Image model does not advertise ' + field)
        refs = len(request['references'])
        limit = params.get('input_references') or {}
        if refs < limit.get('min', 0) or refs > limit.get('max', -1):
            raise ValueError('Image reference count unsupported')
    else:
        for field, value in (('supported_aspect_ratios', execution['aspectRatio']),
                             ('supported_resolutions', execution['resolution']),
                             ('supported_durations', execution['durationSec'])):
            if value not in (model.get(field) or []):
                raise ValueError('Video model does not advertise ' + field)
        if 'first_frame' not in (model.get('supported_frame_images') or []):
            raise ValueError('Video model lacks first-frame input')
        if execution['audio'] and model.get('generate_audio') is not True:
            raise ValueError('Video model does not advertise generated audio')
    return model


def estimate(stage, model, request, discovery_data, allow_legacy=True):
    pricing = model.get('pricing_skus') or {}
    if stage == 'video':
        resolution = request['execution']['resolution']
        seconds = request['execution']['durationSec']
        current = 'duration_seconds_' + resolution
        if current in pricing:
            return float(pricing[current]) * seconds
        legacy = 'cents_per_video_output_second_' + resolution
        if allow_legacy and legacy in pricing:
            input_cost = float(pricing.get('cents_per_image_input', 0))
            return (float(pricing[legacy]) * seconds + input_cost) / 100
        raise ValueError('No current video price for selected resolution')
    endpoints = discovery_data.get('image-endpoints') or {}
    prices = (endpoints.get('endpoints') or [{}])[0].get('pricing') or []
    resolution = request['execution'].get('imageResolution', request['execution']['resolution'])
    variant = 'high_resolution' if resolution in ('2K', '4K') else None
    output = next((item for item in prices if item.get('billable') == 'output_image' and item.get('variant') == variant), None)
    if output is None and variant is not None:
        raise ValueError('No verifiable high-resolution image price')
    if output is None:
        output = next((item for item in prices if item.get('billable') == 'output_image' and not item.get('variant')), None)
    input_price = next((item for item in prices if item.get('billable') == 'input_image'), None)
    if not output or not input_price:
        raise ValueError('No verifiable image input/output price')
    return float(output['cost_usd']) + float(input_price['cost_usd']) * len(request['references'])


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = build_opener(NoRedirect)


def api_url(url):
    parsed = urlparse(url)
    return parsed.scheme == 'https' and parsed.netloc == API_HOST and parsed.path.startswith('/api/v1/')


def key_from_env(root):
    value = os.environ.get('OPENROUTER_API_KEY')
    if value:
        return value
    env = root / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8-sig').splitlines():
            name, sep, value = line.strip().removeprefix('export ').partition('=')
            if sep and name.strip() == 'OPENROUTER_API_KEY' and value.strip().strip('"\''):
                return value.strip().strip('"\'')
    raise ValueError('OPENROUTER_API_KEY unavailable')


def http_json(url, key, payload=None):
    if not api_url(url):
        raise ValueError('Refusing authenticated request outside OpenRouter API')
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {'Authorization': 'Bearer ' + key, 'User-Agent': 'ProductVideoRuntime/1'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    try:
        with OPENER.open(Request(url, data=data, headers=headers), timeout=90) as response:
            return json.load(response)
    except HTTPError as error:
        raise ValueError('Provider HTTP ' + str(error.code)) from None


def response(args, url, key=None, payload=None):
    if args.recorded:
        return read(args.recorded)
    return http_json(url, key, payload)


def discovery(run, args, root):
    if args.recorded:
        data = read(args.recorded)
    else:
        key = key_from_env(root)
        request = frozen(run)['request']
        image_model = request['execution']['models']['image']
        if not isinstance(image_model, str) or '/' not in image_model or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/' for c in image_model):
            raise ValueError('Invalid image model ID')
        data = {'key': http_json(BASE + '/key', key),
                'image-models': http_json(BASE + '/images/models', key),
                'video-models': http_json(BASE + '/videos/models', key),
                'image-endpoints': http_json(BASE + '/images/models/' + image_model + '/endpoints', key)}
    if not all(name in data for name in ('key', 'image-models', 'video-models', 'image-endpoints')):
        raise ValueError('Incomplete discovery')
    key_info = data['key'].get('data') or {}
    account = {name: key_info.get(name) for name in ('limit_remaining', 'usage', 'limit')}
    sanitized = {'observedAt': now(), 'key': {'data': account}, 'image-models': data['image-models'],
                 'video-models': data['video-models'], 'image-endpoints': data['image-endpoints'],
                 'recorded': bool(args.recorded)}
    replace_json(run / 'discovery.json', sanitized)
    return {'observedAt': sanitized['observedAt'], 'imageModels': len(data['image-models']['data']),
            'videoModels': len(data['video-models']['data']), 'recorded': bool(args.recorded)}


@contextmanager
def ledger_lock(ledger):
    ledger.mkdir(parents=True, exist_ok=True)
    lock = ledger / '.lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise ValueError('Shared budget ledger is busy; retry after the other operation finishes') from None
    try:
        yield
    finally:
        lock.rmdir()


def ledger_entries(ledger, identity):
    for path in ledger.glob('*.json'):
        entry = read(path)
        if entry.get('keyIdentity') == identity:
            yield path, entry


def reserve(run, stage, args, request, estimate_usd, discovery_data, identity):
    marker = run / (stage + '-submission.json')
    if marker.exists():
        raise ValueError('Stage already submitted or ambiguous; refusing duplicate paid request')
    ledger = args.ledger
    with ledger_lock(ledger):
        if marker.exists():
            raise ValueError('Stage already claimed')
        entries = list(ledger_entries(ledger, identity))
        this_run = sum(float(e.get('chargedUsd') if e.get('chargedUsd') is not None else e['estimateUsd'])
                       for _, e in entries if e['run'] == str(run))
        accounted = sum(float(e.get('chargedUsd') if e.get('chargedUsd') is not None else e['estimateUsd'])
                        for _, e in entries)
        ceiling = float(request['execution']['budget']['maxUsd'])
        remaining = discovery_data['key']['data'].get('limit_remaining')
        if this_run + estimate_usd > ceiling + 1e-9:
            raise ValueError('Run ceiling exceeded')
        if remaining is None or accounted + estimate_usd > float(remaining) + 1e-9:
            raise ValueError('Shared key headroom insufficient or unavailable')
        marker_data = {'state': 'ambiguous', 'stage': stage, 'claimedAt': now(),
                       'estimateUsd': estimate_usd, 'keyIdentity': identity}
        write_once(marker, marker_data)
        write_once(ledger / (sha((str(run) + ':' + stage).encode()) + '.json'),
                   {'run': str(run), 'stage': stage, 'keyIdentity': identity,
                    'estimateUsd': estimate_usd, 'chargedUsd': None, 'claimedAt': marker_data['claimedAt']})
    return marker


def charge(ledger, run, stage, cost):
    if cost is None:
        return
    path = ledger / (sha((str(run) + ':' + stage).encode()) + '.json')
    if path.exists():
        entry = read(path)
        entry['chargedUsd'] = float(cost)
        replace_json(path, entry)


def submit(run, stage, args, root):
    envelope = frozen(run)
    request = envelope['request']
    marker = run / (stage + '-submission.json')
    if marker.exists():
        raise ValueError('Submission already claimed; inspect receipt or resolve ambiguous state')
    payload = payload_for(run, stage, envelope)
    if args.recorded:
        catalog = read(args.catalog)
    else:
        if not args.authorize:
            raise ValueError('Live submission requires --authorize')
        catalog = read(run / 'discovery.json')
        age = time.time() - datetime.fromisoformat(catalog['observedAt']).timestamp()
        if catalog.get('recorded') or age < 0 or age > 900:
            raise ValueError('Fresh live discovery required before paid submission')
    model = model_for(stage, request, catalog)
    estimate_usd = estimate(stage, model, request, catalog, allow_legacy=bool(args.recorded))
    key = None if args.recorded else key_from_env(root)
    if not args.recorded:
        # An earlier catalog snapshot may overstate the remaining balance.
        latest = (http_json(BASE + '/key', key).get('data') or {}).get('limit_remaining')
        previous = catalog['key']['data'].get('limit_remaining')
        if latest is None:
            raise ValueError('Live key headroom unavailable')
        catalog['key']['data']['limit_remaining'] = min(float(previous), float(latest)) if previous is not None else float(latest)
    identity = args.key_identity if args.recorded else sha(key.encode())
    if not identity:
        raise ValueError('Key identity required for recorded submission')
    reserve(run, stage, args, request, estimate_usd, catalog, identity)
    try:
        result = response(args, BASE + ('/images' if stage == 'image' else '/videos'), key, payload)
    except Exception:
        # The POST may have been accepted. The write-once marker and reservation remain.
        raise ValueError('Submission outcome ambiguous; do not retry this stage') from None
    receipt_path = run / (stage + '-response.json')
    if stage == 'image':
        items = result.get('data') or []
        if not items or not items[0].get('b64_json'):
            write_once(receipt_path, {'error': 'Image response has no content', 'usage': result.get('usage')})
            raise ValueError('Image response incomplete; inspect receipt')
        raw = base64.b64decode(items[0]['b64_json'], validate=True)
        write_once(receipt_path, {'usage': result.get('usage'), 'media_type': items[0].get('media_type'),
                                  'bytes': len(raw), 'sha256': sha(raw)})
        with (run / 'first-frame.bin').open('xb') as file:
            file.write(raw)
        write_once(run / 'first-frame-meta.json', {'media_type': items[0].get('media_type'), 'sha256': sha(raw), 'bytes': len(raw)})
    else:
        safe = {key: result.get(key) for key in ('id', 'polling_url', 'status', 'usage', 'error') if key in result}
        write_once(receipt_path, safe)
        if not safe.get('id'):
            raise ValueError('Video response lacks job ID; submission remains claimed')
    charge(args.ledger, run, stage, (result.get('usage') or {}).get('cost'))
    return {'stage': stage, 'receipt': str(receipt_path), 'jobId': result.get('id'), 'estimatedUsd': estimate_usd}


def poll(run, args, root):
    accepted = read(run / 'video-response.json')
    job = accepted['id']
    url = accepted.get('polling_url') or BASE + '/videos/' + job
    if not api_url(url):
        raise ValueError('Untrusted polling URL')
    key = None if args.recorded else key_from_env(root)
    status = response(args, url, key)
    if status.get('id') not in (None, job):
        raise ValueError('Poll response refers to another job')
    status['id'] = job
    safe = {name: status.get(name) for name in ('id', 'status', 'usage', 'unsigned_urls', 'error') if name in status}
    replace_json(run / 'video-status.json', safe)
    with (run / 'poll-history.jsonl').open('a', encoding='utf-8') as file:
        file.write(json.dumps({'time': now(), 'status': safe.get('status'), 'usage': safe.get('usage')}) + '\n')
    charge(args.ledger, run, 'video', (status.get('usage') or {}).get('cost'))
    return {'jobId': job, 'status': safe.get('status'), 'terminal': safe.get('status') in TERMINAL}


def download(run, args, root):
    target = run / 'video-raw.mp4'
    if target.exists():
        return {'file': str(target), 'sha256': sha(target.read_bytes()), 'reused': True}
    status = read(run / 'video-status.json')
    if status.get('status') != 'completed':
        raise ValueError('Accepted video job is not complete')
    accepted = read(run / 'video-response.json')
    urls = status.get('unsigned_urls') or []
    url = urls[0] if urls else BASE + '/videos/' + accepted['id'] + '/content'
    temporary = run / 'video-raw.mp4.partial'
    if args.recorded:
        source = Path(args.recorded).open('rb')
    else:
        key = key_from_env(root)
        for _ in range(6):
            parsed = urlparse(url)
            if parsed.scheme != 'https':
                raise ValueError('Refusing non-HTTPS media URL')
            headers = {'User-Agent': 'ProductVideoRuntime/1'}
            if api_url(url):
                headers['Authorization'] = 'Bearer ' + key
            try:
                source = OPENER.open(Request(url, headers=headers), timeout=120)
                break
            except HTTPError as error:
                if error.code not in (301, 302, 303, 307, 308) or not error.headers.get('Location'):
                    error.close()
                    raise ValueError('Media download HTTP ' + str(error.code)) from None
                url = urljoin(url, error.headers['Location'])
                error.close()
        else:
            raise ValueError('Too many media redirects')
    digest = hashlib.sha256()
    size = 0
    with source, temporary.open('wb') as output:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
            output.write(chunk)
    if size == 0:
        raise ValueError('Empty downloaded media')
    os.replace(temporary, target)
    meta = {'bytes': size, 'sha256': digest.hexdigest(), 'downloadedAt': now()}
    write_once(run / 'raw-video-meta.json', meta)
    return {'file': str(target), **meta, 'reused': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    parser.add_argument('operation', choices=['discover', 'dry-run', 'submit-image', 'submit-video', 'poll', 'download', 'metadata'])
    parser.add_argument('--stage', choices=['image', 'video'])
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--recorded', type=Path)
    parser.add_argument('--authorize', action='store_true')
    parser.add_argument('--key-identity')
    parser.add_argument('--ledger', type=Path)
    args = parser.parse_args(argv)
    run = args.run.resolve()
    root = Path(__file__).resolve().parents[4]
    args.ledger = args.ledger or root / 'out/product-video-ledger'
    if args.operation == 'discover':
        result = discovery(run, args, root)
    elif args.operation == 'dry-run':
        if not args.stage:
            raise ValueError('--stage required')
        result = {'stage': args.stage, 'request': summary(payload_for(run, args.stage, frozen(run))), 'network': False}
        if args.catalog and args.catalog.exists():
            envelope = frozen(run)
            model = model_for(args.stage, envelope['request'], read(args.catalog))
            result['estimatedUsd'] = estimate(args.stage, model, envelope['request'], read(args.catalog))
    elif args.operation.startswith('submit-'):
        result = submit(run, args.operation.removeprefix('submit-'), args, root)
    elif args.operation == 'poll':
        result = poll(run, args, root)
    elif args.operation == 'download':
        result = download(run, args, root)
    else:
        envelope = frozen(run)
        result = {'requestId': envelope['request']['id'], 'projectId': envelope['request']['projectId'],
                  'stages': {stage: {name: (run / (stage + suffix)).exists() for name, suffix in
                                     [('claimed', '-submission.json'), ('receipt', '-response.json')]}
                             for stage in ('image', 'video')},
                  'videoStatus': read(run / 'video-status.json').get('status') if (run / 'video-status.json').exists() else None,
                  'rawVideo': (run / 'video-raw.mp4').exists()}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error).replace(os.environ.get('OPENROUTER_API_KEY') or '\0', '[REDACTED]'), file=sys.stderr)
        raise SystemExit(1)

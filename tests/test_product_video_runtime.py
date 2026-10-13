import json
import hashlib
import importlib.util
import io
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError


ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / '.agents/skills/generate-product-video/scripts/runtime.py'


class RuntimeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run = self.root / 'projects/demo/work/product-video/11111111-1111-1111-1111-111111111111'
        (self.run / 'inputs').mkdir(parents=True)
        (self.run / 'inputs/000').write_bytes(b'fake-image')
        self.request = {
            'request': {'schemaVersion': 1, 'id': self.run.name, 'projectId': 'demo', 'action': 'generate',
                        'workflow': 'direct', 'references': [{'role': 'product', 'path': 'projects/demo/media/product.png'}],
                        'execution': {'provider': 'openrouter', 'models': {'image': 'test/image', 'video': 'test/video'},
                                      'durationSec': 5, 'aspectRatio': '9:16', 'resolution': '720p', 'audio': False,
                                      'budget': {'currency': 'USD', 'maxUsd': 2}}},
            'context': {'files': [{'path': 'projects/demo/media/product.png', 'snapshotPath': 'inputs/000',
                                   'sha256': hashlib.sha256(b'fake-image').hexdigest()}]}}
        (self.run / 'request.json').write_text(json.dumps(self.request))
        (self.run / 'image-prompt.md').write_text('An honest product image')
        (self.run / 'video-prompt.md').write_text('Camera moves past the product')
        self.catalog = self.root / 'catalog.json'
        self.catalog.write_text(json.dumps({
            'key': {'data': {'limit_remaining': 0.75}},
            'image-models': {'data': [{'id': 'test/image', 'supported_parameters': {
                'aspect_ratio': {'values': ['9:16']}, 'resolution': {'values': ['720p']},
                'input_references': {'min': 0, 'max': 2}}}]},
            'image-endpoints': {'endpoints': [{'pricing': [
                {'billable': 'output_image', 'unit': 'image', 'cost_usd': 0.1},
                {'billable': 'input_image', 'unit': 'image', 'cost_usd': 0.01}]}]},
            'video-models': {'data': [{'id': 'test/video', 'supported_aspect_ratios': ['9:16'],
                'supported_resolutions': ['720p'], 'supported_durations': [5],
                'supported_frame_images': ['first_frame'], 'generate_audio': False,
                'pricing_skus': {'cents_per_video_output_second_720p': '10'}}]}}))

    def cli(self, *args):
        return subprocess.run([sys.executable, str(CLI), str(self.run), *args, '--ledger', str(self.root / 'ledger')],
                              capture_output=True, text=True)

    def test_dry_run_is_offline_and_requires_frozen_snapshot(self):
        result = self.cli('dry-run', '--stage', 'image', '--catalog', str(self.root / 'missing.json'))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('test/image', result.stdout)
        self.assertFalse((self.root / 'ledger').exists())

    def test_recorded_submission_is_write_once_and_preserves_bytes(self):
        fixture = self.root / 'image.json'
        import base64
        fixture.write_text(json.dumps({'data': [{'b64_json': base64.b64encode(b'image bytes').decode(),
                                                  'media_type': 'image/png'}], 'usage': {'cost': 0.08}}))
        result = self.cli('submit-image', '--recorded', str(fixture), '--catalog', str(self.catalog),
                          '--key-identity', 'shared')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.run / 'first-frame.bin').read_bytes(), b'image bytes')
        duplicate = self.cli('submit-image', '--recorded', str(fixture), '--catalog', str(self.catalog),
                             '--key-identity', 'shared')
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertIn('already claimed', duplicate.stderr)

    def test_ambiguous_submission_blocks_retry(self):
        result = self.cli('submit-image', '--recorded', str(self.root / 'missing-response.json'),
                          '--catalog', str(self.catalog), '--key-identity', 'shared')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.run / 'image-submission.json').exists())
        self.assertFalse((self.run / 'image-response.json').exists())

    def test_two_projects_share_budget_reservations(self):
        fixture = self.root / 'accepted.json'
        fixture.write_text(json.dumps({'id': 'job-1', 'status': 'queued'}))
        (self.run / 'first-frame.bin').write_bytes(b'frame')
        (self.run / 'first-frame-meta.json').write_text(json.dumps({'sha256': hashlib.sha256(b'frame').hexdigest()}))
        first = self.cli('submit-video', '--recorded', str(fixture), '--catalog', str(self.catalog),
                         '--key-identity', 'shared')
        self.assertEqual(first.returncode, 0, first.stderr)
        other = self.root / 'projects/other/work/product-video/22222222-2222-2222-2222-222222222222'
        other.mkdir(parents=True)
        request = json.loads((self.run / 'request.json').read_text())
        request['request']['id'] = other.name
        request['request']['projectId'] = 'other'
        request['request']['references'][0]['path'] = 'projects/other/media/product.png'
        request['context']['files'][0]['path'] = 'projects/other/media/product.png'
        (other / 'inputs').mkdir()
        (other / 'inputs/000').write_bytes(b'fake-image')
        (other / 'request.json').write_text(json.dumps(request))
        (other / 'first-frame.bin').write_bytes(b'frame')
        (other / 'first-frame-meta.json').write_text(json.dumps({'sha256': hashlib.sha256(b'frame').hexdigest()}))
        (other / 'video-prompt.md').write_text('Camera moves')
        second = subprocess.run([sys.executable, str(CLI), str(other), 'submit-video', '--recorded', str(fixture),
                                 '--catalog', str(self.catalog), '--key-identity', 'shared',
                                 '--ledger', str(self.root / 'ledger')], capture_output=True, text=True)
        self.assertNotEqual(second.returncode, 0)
        self.assertIn('headroom', second.stderr)

    def test_poll_and_download_reuse_accepted_job(self):
        (self.run / 'video-response.json').write_text(json.dumps({'id': 'job-1', 'status': 'queued'}))
        poll_fixture = self.root / 'completed.json'
        poll_fixture.write_text(json.dumps({'id': 'job-1', 'status': 'completed',
                                             'unsigned_urls': ['https://media.example/video.mp4'],
                                             'usage': {'cost': 0.4}}))
        poll = self.cli('poll', '--recorded', str(poll_fixture))
        self.assertEqual(poll.returncode, 0, poll.stderr)
        binary = self.root / 'video.mp4'
        binary.write_bytes(b'raw mp4 fixture')
        result = self.cli('download', '--recorded', str(binary))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.run / 'video-raw.mp4').read_bytes(), b'raw mp4 fixture')
        again = self.cli('download', '--recorded', str(self.root / 'missing.mp4'))
        self.assertEqual(again.returncode, 0, again.stderr)

    def test_external_media_redirect_has_no_authorization(self):
        spec = importlib.util.spec_from_file_location('product_video_runtime', CLI)
        runtime = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runtime)
        (self.run / 'video-response.json').write_text(json.dumps({'id': 'job-1'}))
        (self.run / 'video-status.json').write_text(json.dumps({'status': 'completed', 'id': 'job-1'}))
        class Stream:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, size):
                self.calls += 1
                return b'clip' if self.calls == 1 else b''
            calls = 0
        class Opener:
            requests = []
            def open(self, request, timeout):
                self.requests.append(request)
                if len(self.requests) == 1:
                    raise HTTPError('https://openrouter.ai/api/v1/videos/job-1/content', 302, 'redirect',
                                    {'Location': 'https://media.example/file.mp4'}, io.BytesIO())
                return Stream()
        opener = Opener()
        runtime.OPENER = opener
        args = type('Args', (), {'recorded': None})()
        runtime.key_from_env = lambda root: 'test-secret'
        result = runtime.download(self.run, args, self.root)
        self.assertEqual(result['bytes'], 4)
        self.assertIn('Authorization', opener.requests[0].headers)
        self.assertNotIn('Authorization', opener.requests[1].headers)

    def test_terminal_failure_retains_job_and_prevents_download(self):
        (self.run / 'video-response.json').write_text(json.dumps({'id': 'job-1'}))
        failed = self.root / 'failed.json'
        failed.write_text(json.dumps({'id': 'job-1', 'status': 'failed', 'error': 'provider failure'}))
        result = self.cli('poll', '--recorded', str(failed))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"terminal": true', result.stdout)
        self.assertEqual(json.loads((self.run / 'video-response.json').read_text())['id'], 'job-1')
        self.assertNotEqual(self.cli('download', '--recorded', str(failed)).returncode, 0)

    def test_delayed_usage_replaces_reservation_for_later_stage(self):
        fixture = self.root / 'accepted.json'
        fixture.write_text(json.dumps({'id': 'job-1', 'status': 'queued'}))
        (self.run / 'first-frame.bin').write_bytes(b'frame')
        (self.run / 'first-frame-meta.json').write_text(json.dumps({'sha256': hashlib.sha256(b'frame').hexdigest()}))
        self.assertEqual(self.cli('submit-video', '--recorded', str(fixture), '--catalog', str(self.catalog),
                                  '--key-identity', 'shared').returncode, 0)
        status = self.root / 'status.json'
        status.write_text(json.dumps({'id': 'job-1', 'status': 'completed', 'usage': {'cost': 0.7}}))
        self.assertEqual(self.cli('poll', '--recorded', str(status)).returncode, 0)
        image = self.root / 'image.json'
        image.write_text(json.dumps({'data': []}))
        result = self.cli('submit-image', '--recorded', str(image), '--catalog', str(self.catalog),
                          '--key-identity', 'shared')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ceiling', result.stderr) if 'ceiling' in result.stderr else self.assertIn('headroom', result.stderr)

    def test_concurrent_duplicate_submission_has_one_receipt(self):
        fixture = self.root / 'accepted.json'
        fixture.write_text(json.dumps({'id': 'job-1', 'status': 'queued'}))
        (self.run / 'first-frame.bin').write_bytes(b'frame')
        (self.run / 'first-frame-meta.json').write_text(json.dumps({'sha256': hashlib.sha256(b'frame').hexdigest()}))
        arguments = ('submit-video', '--recorded', str(fixture), '--catalog', str(self.catalog),
                     '--key-identity', 'shared')
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.cli(*arguments), range(2)))
        self.assertEqual(sum(result.returncode == 0 for result in results), 1)
        self.assertEqual(json.loads((self.run / 'video-response.json').read_text())['id'], 'job-1')
        self.assertEqual(len(list((self.root / 'ledger').glob('*.json'))), 1)


if __name__ == '__main__':
    unittest.main()

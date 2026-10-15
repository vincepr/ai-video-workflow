import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / '.agents/skills/transfer-project/scripts/project_bundle.py'


class ProjectBundleTest(unittest.TestCase):
    def run_bundle(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)

    def test_export_import_restores_ignored_project_data_without_tracked_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            source = base / 'source'
            destination = base / 'destination'
            for root in (source, destination):
                project = root / 'projects' / 'example'
                project.mkdir(parents=True)
                (project / 'project.json').write_text(json.dumps({'id': 'example', 'title': 'Example'}))
            (source / 'projects/example/media').mkdir()
            (source / 'projects/example/media/frame.png').write_bytes(b'frame')
            (source / 'projects/example/work').mkdir()
            (source / 'projects/example/work/run.json').write_text('{"model":"example"}')
            revision_id = '00000000-0000-4000-8000-000000000001'
            revisions = source / 'projects/example/work/agent-video/revisions'
            revisions.mkdir(parents=True)
            (revisions / f'{revision_id}.json').write_text(json.dumps({
                'schemaVersion': 2, 'projectId': 'example', 'revisionId': revision_id,
                'frozenAt': '2026-10-15T00:00:00.000Z', 'references': [], 'budgetUsd': 0,
                'estimateUsd': 0, 'plan': {'concept': 'Transfer test', 'shots': [], 'stages': []}}))
            (source / 'projects/example/videos').mkdir()
            (source / 'projects/example/videos/video.mp4').write_bytes(b'video')
            archive = base / 'example.zip'

            exported = self.run_bundle('export', source, 'example', archive)
            self.assertEqual(exported.returncode, 0, exported.stderr)
            imported = self.run_bundle('import', destination, archive)
            self.assertEqual(imported.returncode, 0, imported.stderr)
            self.assertEqual((destination / 'projects/example/media/frame.png').read_bytes(), b'frame')
            self.assertEqual((destination / 'projects/example/work/run.json').read_text(), '{"model":"example"}')
            self.assertEqual(json.loads((destination / 'projects/example/work/agent-video/revisions' / f'{revision_id}.json').read_text())['plan']['concept'], 'Transfer test')
            module = (Path(__file__).resolve().parents[1] / 'scripts/agent-video.mjs').as_uri()
            inspected = subprocess.run(['node', '--input-type=module', '-e',
                f"import {{agentStatus}} from '{module}'; console.log((await agentStatus(process.argv[1], 'example', '{revision_id}')).revision.plan.concept)",
                str(destination)], capture_output=True, text=True)
            self.assertEqual(inspected.returncode, 0, inspected.stderr)
            self.assertEqual(inspected.stdout.strip(), 'Transfer test')
            self.assertEqual((destination / 'projects/example/videos/video.mp4').read_bytes(), b'video')
            self.assertEqual(json.loads((destination / 'projects/example/project.json').read_text())['title'], 'Example')

            second_import = self.run_bundle('import', destination, archive)
            self.assertNotEqual(second_import.returncode, 0)
            self.assertIn('clashes', second_import.stderr)
            self.assertEqual((destination / 'projects/example/media/frame.png').read_bytes(), b'frame')

    def test_import_rejects_path_escape_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / 'projects/example'
            project.mkdir(parents=True)
            (project / 'project.json').write_text('{"id":"example","title":"Example"}')
            archive = root / 'bad.zip'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr('media/../escaped.txt', b'bad')
                bundle.writestr('bundle.json', json.dumps({'format': 'ai-video-project-data-v1',
                    'projectId': 'example', 'files': [{'path': 'media/../escaped.txt', 'size': 3,
                    'sha256': '2f05d4b689d270cafb02285f35f44866f32a7cf3e58d91d6b2b34d8001928d2f'}]}))
            imported = self.run_bundle('import', root, archive)
            self.assertNotEqual(imported.returncode, 0)
            self.assertFalse((root / 'projects/example/escaped.txt').exists())

    def test_import_checks_all_hashes_before_adding_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root / 'projects/example'
            project.mkdir(parents=True)
            (project / 'project.json').write_text('{"id":"example","title":"Example"}')
            archive = root / 'corrupt.zip'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr('media/one.txt', b'one')
                bundle.writestr('work/two.txt', b'wrong')
                bundle.writestr('bundle.json', json.dumps({'format': 'ai-video-project-data-v1',
                    'projectId': 'example', 'files': [
                        {'path': 'media/one.txt', 'size': 3, 'sha256': '7692c3ad3540bb803c020b3aee66cd8887123234ea0c6e7143c0add73ff431ed'},
                        {'path': 'work/two.txt', 'size': 5, 'sha256': '0' * 64}]}))
            imported = self.run_bundle('import', root, archive)
            self.assertNotEqual(imported.returncode, 0)
            self.assertIn('mismatch', imported.stderr)
            self.assertFalse((project / 'media/one.txt').exists())


if __name__ == '__main__':
    unittest.main()

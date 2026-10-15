"""Transfer a project's ignored media, work records and videos in one ZIP."""

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath


DATA_DIRS = ('media', 'work', 'videos')
FORMAT = 'ai-video-project-data-v1'


def fail(message):
    raise ValueError(message)


def project_dir(root, project_id):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', project_id):
        fail('Invalid project ID')
    directory = root / 'projects' / project_id
    metadata = directory / 'project.json'
    if not metadata.is_file() or json.loads(metadata.read_text(encoding='utf-8')).get('id') != project_id:
        fail(f'Project {project_id} is missing or has mismatched project.json')
    return directory


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    path = PurePosixPath(name)
    if (not name or '\\' in name or name.startswith('/') or ':' in name or
            any(part in ('', '.', '..') for part in name.split('/')) or
            len(path.parts) < 2 or path.parts[0] not in DATA_DIRS):
        fail(f'Unsafe bundle path: {name}')
    return path


def export_project(root, project_id, archive):
    project = project_dir(root, project_id)
    archive = archive.resolve()
    if archive.exists():
        fail(f'Archive already exists: {archive}')
    if project.resolve() in archive.parents:
        fail('Archive must be outside the project directory')
    files = []
    for folder in DATA_DIRS:
        directory = project / folder
        if directory.is_symlink():
            fail(f'Symlink in project data: {directory}')
        if not directory.exists():
            continue
        for path in sorted(directory.rglob('*')):
            if path.is_symlink():
                fail(f'Symlink in project data: {path}')
            if path.is_file():
                name = path.relative_to(project).as_posix()
                files.append((name, path))
    archive.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.project-bundle-', suffix='.zip', dir=archive.parent)
    os.close(fd)
    try:
        entries = []
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as bundle:
            for name, path in files:
                data = path.read_bytes()
                bundle.writestr(name, data)
                entries.append({'path': name, 'size': len(data), 'sha256': digest(data)})
            bundle.writestr('bundle.json', json.dumps({'format': FORMAT, 'projectId': project_id,
                'files': entries}, indent=2) + '\n')
        os.link(temporary, archive)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f'Exported {len(files)} files to {archive}')


def import_project(root, archive):
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if len(names) != len(set(names)) or names.count('bundle.json') != 1:
            fail('Duplicate or missing bundle entries')
        manifest = json.loads(bundle.read('bundle.json'))
        if manifest.get('format') != FORMAT or not isinstance(manifest.get('files'), list):
            fail('Unsupported bundle format')
        project_id = manifest.get('projectId')
        if not isinstance(project_id, str):
            fail('Invalid project ID in bundle')
        project = project_dir(root, project_id)
        records = manifest['files']
        expected = {'bundle.json'}
        for record in records:
            if not isinstance(record, dict) or not isinstance(record.get('path'), str):
                fail('Invalid bundle manifest')
            name = record['path']
            safe_name(name)
            if name in expected or not isinstance(record.get('size'), int) or record['size'] < 0:
                fail(f'Invalid bundle record: {name}')
            expected.add(name)
        if set(names) != expected:
            fail('Bundle contents do not match manifest')
        clashes = []
        for record in records:
            target = project.joinpath(*PurePosixPath(record['path']).parts)
            if target.exists() or target.is_symlink() or any(parent.is_symlink() or
                    (parent.exists() and not parent.is_dir()) for parent in target.parents if parent != project.parent.parent):
                clashes.append(record['path'])
        if clashes:
            fail('Import clashes with existing files or paths: ' + ', '.join(clashes[:20]))
        with tempfile.TemporaryDirectory(prefix='.project-import-', dir=project) as staging:
            staged = Path(staging)
            for record in records:
                name = record['path']
                data = bundle.read(name)
                if len(data) != record['size'] or digest(data) != record.get('sha256'):
                    fail(f'Hash or size mismatch: {name}')
                target = staged.joinpath(*PurePosixPath(name).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            created = []
            try:
                for record in records:
                    name = record['path']
                    target = project.joinpath(*PurePosixPath(name).parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if target.exists() or target.is_symlink():
                        fail(f'Import clash appeared during copy: {name}')
                    os.rename(staged.joinpath(*PurePosixPath(name).parts), target)
                    created.append(target)
            except Exception:
                for target in created:
                    target.unlink()
                raise
    print(f'Imported {len(records)} files into {project}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    export = commands.add_parser('export')
    export.add_argument('root', type=Path)
    export.add_argument('project_id')
    export.add_argument('archive', type=Path)
    restore = commands.add_parser('import')
    restore.add_argument('root', type=Path)
    restore.add_argument('archive', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'export':
            export_project(args.root, args.project_id, args.archive)
        else:
            import_project(args.root, args.archive)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(f'Project transfer failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

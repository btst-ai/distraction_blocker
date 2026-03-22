import os
import sys
import shutil
import re
import json

# Try to import from config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import DEV_BLOCKED_SITES, PUBLIC_BLOCKED_SITES, SITE_CATEGORIES, get_category, NOGO_LIST

def strip_console_logs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove single line console logs
    content = re.sub(r'^[ \t]*console\.(log|info)\s*\(.*?\);?\s*$', '', content, flags=re.MULTILINE)
    
    # Remove inline console logs (basic regex, not perfect but works for most cases)
    content = re.sub(r'console\.(log|info)\s*\([^)]*\);?', '', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

def build(env):
    if env not in ['dev', 'prod']:
        print("Usage: python build.py [dev|prod]")
        sys.exit(1)

    src_dir = 'src'
    dist_dir = f'dist/{env}'

    # Create dist base directory if it doesn't exist
    os.makedirs('dist', exist_ok=True)

    # Remove existing dist dir if exists
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)

    # Copy src to dist
    shutil.copytree(src_dir, dist_dir)

    # Select blocked sites
    blocked_sites = DEV_BLOCKED_SITES if env == 'dev' else PUBLIC_BLOCKED_SITES

    # Update background.js
    bg_file = os.path.join(dist_dir, 'background', 'background.js')
    if os.path.exists(bg_file):
        with open(bg_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update BLOCKED_SITES
        blocked_str = ",\n    ".join([f"'{site}'" for site in blocked_sites])
        content = re.sub(
            r'(// BLOCKED_SITES_START\n).*?(// BLOCKED_SITES_END)',
            f'\\1    {blocked_str}\n    \\2',
            content,
            flags=re.DOTALL
        )

        # Update SITE_CATEGORIES
        categories_str = ",\n    ".join([f"'{site}': '{get_category(site)}'" for site in blocked_sites])
        content = re.sub(
            r'(// SITE_CATEGORIES_START\n).*?(// SITE_CATEGORIES_END)',
            f'\\1    {categories_str}\n    \\2',
            content,
            flags=re.DOTALL
        )
        
        with open(bg_file, 'w', encoding='utf-8') as f:
            f.write(content)

    # Strip logs and handle manifest for prod
    manifest_file = os.path.join(dist_dir, 'manifest.json')
    if os.path.exists(manifest_file):
        with open(manifest_file, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        if env == 'prod':
            manifest['name'] = 'Gorudo'
            if 'action' in manifest and 'default_title' in manifest['action']:
                manifest['action']['default_title'] = 'Gorudo'
        elif env == 'dev':
            manifest['name'] = 'Gorudo Dev'
            if 'action' in manifest and 'default_title' in manifest['action']:
                manifest['action']['default_title'] = 'Gorudo Dev'

        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)

    if env == 'prod':
        # Walk through all files and strip console logs from JS
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                if file.endswith('.js'):
                    strip_console_logs(os.path.join(root, file))

    print(f"Build complete for {env}. Output in {dist_dir}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python build.py [dev|prod]")
        sys.exit(1)
    build(sys.argv[1])

from playwright.sync_api import sync_playwright
import glob,os
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
    for f in sorted(glob.glob('src/*.html')):
        pg.goto('file://'+os.path.abspath(f)); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.basename(f)[:-5]+'.png')
    b.close()

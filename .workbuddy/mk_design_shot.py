"""把设计稿注入「自动进入某模板的参数配置 tab」的脚本，方便无头截图验收。

用法：python mk_design_shot.py <模板 id> <tab> <输出 html>
例：  python mk_design_shot.py rustfs params ds-rustfs.html
"""
import sys

src = r'C:\workspace\wec-service-manager\design\add-service-modal.html'
tpl = sys.argv[1] if len(sys.argv) > 1 else 'rustfs'
tab = sys.argv[2] if len(sys.argv) > 2 else 'params'
out = sys.argv[3] if len(sys.argv) > 3 else 'ds-shot.html'

s = open(src, encoding='utf-8').read()
inject = (
    '<script>window.addEventListener("load", () => {\n'
    f'  applyTemplate("{tpl}"); showStep("config");\n'
    f'  const tab = document.querySelector(\'.wtab[data-tab="{tab}"]\');\n'
    '  if (tab) tab.click();\n'
    '});</script>'
)
assert s.count('</body>') == 1
s = s.replace('</body>', inject + '\n</body>')

path = r'C:\workspace\wec-service-manager\.workbuddy' + '\\' + out
open(path, 'w', encoding='utf-8').write(s)
print('written', path)

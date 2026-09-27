"""精确测量：应用截图 vs 设计稿截图里的「服务名 / 显示名称」输入框。

只解出需要的行区间，避免整图解码。
"""
import struct
import sys
import zlib


def _unfilter(raw, width, channels, height, y_from, y_to):
    stride = width * channels
    prev = bytearray(stride)
    p = 0
    keep = {}
    for y in range(height):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        if y_from <= y <= y_to:
            keep[y] = bytes(line)
        prev = line
    return keep


def load_rows(path, y_from, y_to):
    data = open(path, 'rb').read()
    pos, idat = 8, b''
    width = height = bit_depth = color_type = 0
    while pos < len(data):
        (length,) = struct.unpack('>I', data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b'IHDR':
            width, height, bit_depth, color_type = struct.unpack('>IIBB', chunk[:10])
        elif ctype == b'IDAT':
            idat += chunk
        elif ctype == b'IEND':
            break
    channels = {2: 3, 6: 4}[color_type]
    rows = _unfilter(zlib.decompress(idat), width, channels, height, y_from, y_to)
    return width, channels, rows


def px(rows, channels, x, y):
    row = rows[y]
    i = x * channels
    return row[i], row[i + 1], row[i + 2]


def dark(rows, channels, x, y, thr):
    r, g, b = px(rows, channels, x, y)
    return r < thr and g < thr and b < thr


def col_runs(rows, channels, x, y0, y1, thr=228):
    runs, start = [], None
    for y in range(y0, y1 + 1):
        d = dark(rows, channels, x, y, thr)
        if d and start is None:
            start = y
        elif not d and start is not None:
            runs.append((start, y - 1)); start = None
    if start is not None:
        runs.append((start, y1))
    return runs


def row_runs(rows, channels, y, x0, x1, thr=228):
    runs, start = [], None
    for x in range(x0, x1 + 1):
        d = dark(rows, channels, x, y, thr)
        if d and start is None:
            start = x
        elif not d and start is not None:
            runs.append((start, x - 1)); start = None
    if start is not None:
        runs.append((start, x1))
    return runs


def profile(rows, channels, x, y0, y1):
    out = []
    for y in range(y0, y1 + 1):
        r, g, b = px(rows, channels, x, y)
        lum = (r * 299 + g * 587 + b * 114) // 1000
        out.append((y, lum, r, g, b))
    return out


if __name__ == '__main__':
    path = sys.argv[1]
    mode = sys.argv[2]
    width, channels, rows = None, None, None
    if mode == 'col':
        x = int(sys.argv[3])
        y0, y1 = int(sys.argv[4]), int(sys.argv[5])
        thr = int(sys.argv[6]) if len(sys.argv) > 6 else 235
        width, channels, rows = load_rows(path, y0, y1)
        print(f'image {width}px, channels {channels}, thr {thr}')
        for a, b in col_runs(rows, channels, x, y0, y1, thr):
            print(f'   y {a:>5} .. {b:>5}   高 {b - a + 1}')
    elif mode == 'row':
        y = int(sys.argv[3])
        x0, x1 = int(sys.argv[4]), int(sys.argv[5])
        thr = int(sys.argv[6]) if len(sys.argv) > 6 else 235
        width, channels, rows = load_rows(path, y, y)
        print(f'image {width}px, channels {channels}, thr {thr}')
        for a, b in row_runs(rows, channels, y, x0, x1, thr):
            print(f'   x {a:>5} .. {b:>5}   宽 {b - a + 1}')
    elif mode == 'prof':
        x = int(sys.argv[3])
        y0, y1 = int(sys.argv[4]), int(sys.argv[5])
        width, channels, rows = load_rows(path, y0, y1)
        for y, lum, r, g, b in profile(rows, channels, x, y0, y1):
            bar = '#' * max(0, (255 - lum) // 6)
            print(f'{y:>5}  {lum:>3}  rgb({r:>3},{g:>3},{b:>3})  {bar}')

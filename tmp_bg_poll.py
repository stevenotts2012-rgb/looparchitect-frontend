import struct, time, urllib.request, urllib.error, datetime
backend='https://web-production-3afc5.up.railway.app/api/v1/loops'
proxy='https://looparchitect-frontend.vercel.app/api/v1/loops'
upload='https://looparchitect-frontend.vercel.app/api/v1/loops/with-file'

sample_rate=22050
num_samples=2205
pcm=b''.join(struct.pack('<h',0) for _ in range(num_samples))
header=struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', 36+len(pcm), b'WAVE', b'fmt ', 16, 1, 1, sample_rate, sample_rate*2, 2, 16, b'data', len(pcm))
wav=header+pcm

def request(url, method='GET', data=None, headers=None, timeout=45):
    try:
        req=urllib.request.Request(url, method=method, data=data, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8','ignore')[:140]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8','ignore')[:140]
    except Exception as e:
        return None, str(e)[:140]

def upload_check():
    boundary='----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body=[]
    for k,v in [('title','rollout-poll'),('genre','house'),('style_description','rollout poll')]:
        body.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode())
    body.append((f'--{boundary}\r\nContent-Disposition: form-data; name="loop_in"; filename="probe.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode()+wav+b'\r\n')
    body.append((f'--{boundary}--\r\n').encode())
    payload=b''.join(body)
    return request(upload, method='POST', data=payload, headers={'Content-Type': f'multipart/form-data; boundary={boundary}','accept':'application/json'}, timeout=90)

for i in range(1,11):
    b=request(backend, headers={'accept':'application/json'})
    p=request(proxy, headers={'accept':'application/json'})
    u=upload_check()
    ts=datetime.datetime.utcnow().isoformat(timespec='seconds')+'Z'
    print(f'[{ts}] Attempt {i}/10 backend={b[0]} proxy={p[0]} upload={u[0]}')
    if b[0] and b[0] < 500 and p[0] and p[0] < 500 and u[0] and u[0] < 500:
        print('GREEN rollout detected')
        print('backend:', b[1])
        print('proxy  :', p[1])
        print('upload :', u[1])
        break
    if i < 10:
        time.sleep(30)

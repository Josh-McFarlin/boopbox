"""An example song for the visualiser mockups: 8 tracks at 22 050 Hz, then 3 s with the transport stopped."""
from common import SCREENS, WORK
import numpy as np
SR=22050; BPM=120; SPB=60/BPM; BARS=8; TAIL=3.0
PLAY=BARS*4*SPB; LEN=PLAY+TAIL
N=int(LEN*SR)
rng=np.random.default_rng(1)
def hz(m): return 440*2**((m-69)/12)
def env(n, a, d, s, r, hold):
    t=np.arange(n)/SR; e=np.zeros(n)
    e=np.where(t<a, t/max(a,1e-4), s+(1-s)*np.exp(-(t-a)/max(d,1e-4)))
    rel=t>hold; e[rel]*=np.exp(-(t[rel]-hold)/max(r,1e-4))
    return e
def saw(f,t,k=12): return sum(np.sin(2*np.pi*f*h*t)/h for h in range(1,k+1))*0.6
def sq(f,t,k=9): return sum(np.sin(2*np.pi*f*h*t)/h for h in range(1,k+1,2))*0.8
def tri(f,t): return 2/np.pi*np.arcsin(np.sin(2*np.pi*f*t))
def lp(x,a):
    y=np.empty_like(x); s=0.0
    for i in range(len(x)): s+=a*(x[i]-s); y[i]=s
    return y
CH=[(57,60,64),(53,57,60),(48,52,55),(55,59,62)]          # Am F C G
ROOT=[45,41,36,43]
EV=[]   # (track, beat, dur_beats, midi, vel)
for bar in range(BARS):
    c=bar%4; b0=bar*4
    for k in range(8): EV.append((0,b0+k*0.5,0.4,ROOT[c]+(12 if k in (3,7) else 0),0.9))          # 1 bass
    for k in range(4): EV.append((3,b0+k,0.25,36,1.0))                                                  # 4 kick
    for k in (1,3): EV.append((3,b0+k,0.25,38,0.8))                                                     # 4 snare
    for k in range(8): EV.append((7,b0+k*0.5,0.1,42,0.5 if k%2 else 0.35))                             # 8 hats
    EV.append((4,b0,4,CH[c][0]-12,0.6)); EV.append((4,b0,4,CH[c][1]-12,0.6)); EV.append((4,b0,4,CH[c][2]-12,0.6))   # 5 pad
    if bar>=2:
        for k in (0.5,1.5,2.5,3.5):
            for m in CH[c]: EV.append((1,b0+k,0.3,m,0.6))                                               # 2 keys
        for k in range(16): EV.append((5,b0+k*0.25,0.2,CH[c][k%3]+12*(k//8%2)+12,0.45))                # 6 arp
    if bar>=4:
        EV.append((7,b0+3.5,0.1,39,0.8))                                                                # 8 clap
        mel=[(0,1,76),(1,0.5,74),(1.5,0.5,72),(2,1.5,71),(3.5,0.5,72)] if bar%2==0 else [(0,1.5,69),(1.5,0.5,71),(2,1,72),(3,1,76)]
        for s,dd,m in mel: EV.append((2,b0+s,dd*0.9,m-(0 if c<2 else 2),0.8))                         # 3 lead
        for k in (0.75,2.25,3.25): EV.append((6,b0+k,0.4,CH[c][1]+24,0.6))                             # 7 pluck
TR=np.zeros((8,N))
for t,beat,dur,m,v in EV:
    s=int(beat*SPB*SR); dsec=dur*SPB
    if t==3 and m==36:
        n=int(0.35*SR); tt=np.arange(n)/SR; f=45+80*np.exp(-tt*28)
        x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)
    elif t==3:
        n=int(0.2*SR); tt=np.arange(n)/SR; x=(rng.standard_normal(n)*0.6+np.sin(2*np.pi*190*tt))*np.exp(-tt*22)*0.7
    elif t==7 and m==42:
        n=int(0.06*SR); x=np.diff(rng.standard_normal(n+1))*np.exp(-np.arange(n)/SR*70)*0.35
    elif t==7:
        n=int(0.18*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n)*np.exp(-tt*25)*(1+0.6*np.sin(2*np.pi*80*tt))*0.6
    else:
        rel={0:0.05,1:0.08,2:0.12,4:0.6,5:0.05,6:0.4}[t]
        n=int((dsec+rel*5)*SR); tt=np.arange(n)/SR; f=hz(m)
        if t==0: x=lp(saw(f,tt,10),0.25)*env(n,0.004,0.15,0.6,rel,dsec)
        elif t==1: x=tri(f,tt)*env(n,0.004,0.12,0.2,rel,dsec)*0.45
        elif t==2: x=sq(f*(1+0.004*np.sin(2*np.pi*5.5*tt)),tt,7)*env(n,0.01,0.3,0.7,rel,dsec)*0.32
        elif t==4: x=(saw(f*1.003,tt,6)+saw(f*0.997,tt,6))*env(n,0.35,1.0,0.8,rel,dsec)*0.12
        elif t==5: x=sq(f,tt,5)*env(n,0.002,0.07,0.0,rel,dsec)*0.22
        else: x=(np.sin(2*np.pi*f*tt)+0.4*np.sin(4*np.pi*f*tt))*np.exp(-tt*7)*0.4
    x=x*v; e=min(N,s+len(x)); TR[t,s:e]+=x[:e-s]
GAIN=[0.9,0.8,0.8,1.0,0.8,0.7,0.8,0.8]
TR*=np.array(GAIN)[:,None]
MIX=TR.sum(0); pk=np.abs(MIX).max(); TR*=0.7/pk; MIX*=0.7/pk
NOTES=sorted([(beat*SPB,t,m) for t,beat,dur,m,v in EV])
KICKS=sorted([beat*SPB for t,beat,dur,m,v in EV if t==3 and m==36])
if __name__=="__main__":
    import wave
    w=wave.open(WORK+"song.wav","wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((MIX*32767).astype(np.int16).tobytes()); w.close()
    print(f"{LEN:.1f} s, {len(EV)} events")

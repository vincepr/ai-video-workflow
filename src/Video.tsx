import {AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import type {Episode, Shot} from './episode';
import {cameraAt, timeline} from './timing';

function Panel({shot, frames}: {shot: Shot; frames: number}) {
  const frame = useCurrentFrame();
  const [x, y, zoom] = cameraAt(shot.from, shot.to, frame / Math.max(1, frames - 1));
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <Img src={staticFile(shot.image)} style={{
      width: '100%', height: '100%', objectFit: 'cover',
      objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`,
    }}/>
    <AbsoluteFill style={{background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.8))'}}/>
    <div style={{position: 'absolute', left: 80, right: 160, bottom: 310,
      color: '#fff9ed', fontSize: 64, fontWeight: 700, lineHeight: 1.15}}>
      {shot.text}
    </div>
  </AbsoluteFill>;
}

export function Video({episode}: {episode: Episode}) {
  return <AbsoluteFill style={{background: '#202627', fontFamily: 'Arial, sans-serif'}}>
    {episode.audio && <Audio src={staticFile(episode.audio)}/>}
    {timeline(episode).map(({shot, from, frames}, i) =>
      <Sequence key={i} from={from} durationInFrames={frames}>
        <Panel shot={shot} frames={frames}/>
      </Sequence>)}
    <div style={{position: 'absolute', top: 160, left: 80, right: 160,
      color: '#fff9ed', fontSize: 30, letterSpacing: 3, textTransform: 'uppercase',
      background: '#202627', padding: '18px 24px', width: 'fit-content'}}>
      {episode.title}
    </div>
  </AbsoluteFill>;
}

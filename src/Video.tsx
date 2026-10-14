import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Episode, ImageShot, Shot} from './episode';
import {cameraAt, timeline, musicVolume} from './timing';

function Panel({shot, frames}: {shot: ImageShot; frames: number}) {
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

function Scene({shot, frames}: {shot: Shot; frames: number}) {
  if ('video' in shot) return <AbsoluteFill style={{overflow: 'hidden'}}>
    <OffthreadVideo src={staticFile(shot.video)} trimBefore={shot.startFrame} durationInFrames={frames} muted
      style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
    {shot.text && <div style={{position: 'absolute', left: 80, right: 160, bottom: 310,
      color: '#fff9ed', fontSize: 64, fontWeight: 700, lineHeight: 1.15}}>{shot.text}</div>}
  </AbsoluteFill>;
  return <Panel shot={shot} frames={frames}/>;
}

export function Video({episode}: {episode: Episode}) {
  const {durationInFrames} = useVideoConfig();
  return <AbsoluteFill style={{background: '#202627', fontFamily: 'Arial, sans-serif'}}>
    {episode.audio && <Audio src={staticFile(episode.audio)}/>}
    {episode.music && <Audio src={staticFile(episode.music.audio)} volume={(frame) => musicVolume(frame,durationInFrames,episode.music!.volume)}/>}
    {timeline(episode).map(({shot, from, frames}, i) =>
      <Sequence key={i} from={from} durationInFrames={frames}>
        <Scene shot={shot} frames={frames}/>
      </Sequence>)}
    <div style={{position: 'absolute', top: 160, left: 80, right: 160,
      color: '#fff9ed', fontSize: 30, letterSpacing: 3, textTransform: 'uppercase',
      background: '#202627', padding: '18px 24px', width: 'fit-content'}}>
      {episode.title}
    </div>
  </AbsoluteFill>;
}

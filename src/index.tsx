import {Composition, registerRoot} from 'remotion';
import sample from '../episodes/sample.json';
import {validateEpisode} from './episode';
import {FPS, timeline} from './timing';
import {Video} from './Video';

const episode = validateEpisode(sample);
const duration = (value: typeof episode) => timeline(value).reduce((sum, shot) => sum + shot.frames, 0);

function Root() {
  return <Composition id="PanelMotion" component={Video}
    width={1080} height={1920} fps={FPS} durationInFrames={duration(episode)}
    defaultProps={{episode}}
    calculateMetadata={({props}) => {
      const validated = validateEpisode(props.episode);
      return {durationInFrames: duration(validated), props: {episode: validated}};
    }}/>;
}

registerRoot(Root);

import { useStore } from '../../state/store'
import { captionAt } from './introState'

/** Captions in the lower third and a Skip button that is there from the first frame. */
export default function IntroOverlay() {
  const intro = useStore((s) => s.intro)
  const caption = useStore((s) => captionAt(s.introTime))
  const finishIntro = useStore((s) => s.finishIntro)
  if (!intro) return null
  return (
    <div className="intro">
      <button className="btn intro-skip" onClick={finishIntro} autoFocus>
        Skip intro
      </button>
      <p className="intro-caption" key={caption} aria-live="polite">
        {caption}
      </p>
    </div>
  )
}

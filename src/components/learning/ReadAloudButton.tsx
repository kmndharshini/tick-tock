import { Volume2 } from 'lucide-react';
import { speakText } from '../../services/audioService';
import { useAppStore } from '../../store/useAppStore';

export interface ReadAloudButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Accessible speaker button that reads prompts, times, or hints aloud on tap.
 */
export function ReadAloudButton({
  text,
  label = 'Read aloud',
  className = '',
}: ReadAloudButtonProps) {
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);

  return (
    <button
      type="button"
      onClick={() => speakText(text, { enabled: soundEnabled })}
      disabled={!soundEnabled}
      aria-label={soundEnabled ? label : `${label} (sound muted)`}
      title={soundEnabled ? label : 'Unmute sound to hear read aloud'}
      className={[
        'touch-target inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border-2 border-minute/30 bg-minute-soft px-3.5 py-2 text-xs font-extrabold text-minute-dark transition-colors hover:bg-minute/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
        className,
      ].join(' ')}
    >
      <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}


import { useRef, useState } from 'react';
import { Icon } from './icons';

interface ComposerProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

export default function Composer({ onSend, placeholder = 'Message Eumae…' }: ComposerProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  return (
    <div className="cmp">
      <textarea
        ref={ref}
        className="cmpIn"
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="cmpBar">
        <button className="cmpIcon" aria-label="Attach">
          <Icon name="clp" />
        </button>
        <button className="cmpIcon" aria-label="Voice">
          <Icon name="mic" />
        </button>
        <button className="cmpSend" onClick={send} aria-label="Send" disabled={!text.trim()}>
          <Icon name="up" />
        </button>
      </div>
    </div>
  );
}

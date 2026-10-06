interface EmptyProps {
  eyebrow: string;
  title: string;
  note: string;
}

export default function Empty({ eyebrow, title, note }: EmptyProps) {
  return (
    <div className="scEmpty">
      <div className="scEmptyK">{eyebrow}</div>
      <h2 className="scEmptyT">{title}</h2>
      <p className="scEmptyN">{note}</p>
    </div>
  );
}

/** One-shot celebration; styles and the reduced-motion opt-out live in RunMode.css. */
export default function ConfettiBurst() {
  return (
    <div className="run__burst" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--burst-index": index }} />)}
    </div>
  );
}

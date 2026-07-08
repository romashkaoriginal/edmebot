import "./SectionTitle.css";

export default function SectionTitle({ children, action }) {
  return (
    <div className="sectiontitle">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

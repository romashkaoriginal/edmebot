import "./Card.css";

export default function Card({ as: Tag = "div", pad = "md", className = "", children, ...props }) {
  return (
    <Tag className={`card card--pad-${pad} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

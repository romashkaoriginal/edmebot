import { forwardRef } from "react";
import "./Card.css";

const Card = forwardRef(function Card({ as: Tag = "div", pad = "md", className = "", children, ...props }, ref) {
  return (
    <Tag ref={ref} className={`card card--pad-${pad} ${className}`} {...props}>
      {children}
    </Tag>
  );
});

export default Card;

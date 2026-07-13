import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageCircle, Search, X } from "lucide-react";
import Button from "../ui/Button";
import useBodyScrollLock from "../../hooks/useBodyScrollLock";

export default function ContactPickerModal({ contacts, isOpen, onClose, onSelect, title = "Выберите контакт" }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const inputRef = useRef(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery("");
    setSelectedId("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) => [contact.name, contact.username, contact.tg_id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery));
  }, [contacts, query]);

  const selectedContact = contacts.find((contact) => contact.tg_id === selectedId);

  if (!isOpen) return null;

  return (
    <div className="contact-picker" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="contact-picker__dialog" role="dialog" aria-modal="true" aria-labelledby="contact-picker-title">
        <header className="contact-picker__head">
          <div>
            <p className="contact-picker__eyebrow"><MessageCircle size={15} /> Контакты Telegram</p>
            <h2 id="contact-picker-title">{title}</h2>
          </div>
          <button className="aicon-btn aicon-btn--close" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <label className="contact-picker__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, @username или Telegram ID"
            aria-label="Поиск контакта"
          />
        </label>

        <div className="contact-picker__results" role="listbox" aria-label="Контакты из чата бота">
          {filteredContacts.length ? filteredContacts.map((contact) => {
            const isSelected = contact.tg_id === selectedId;
            return (
              <button
                className={`contact-picker__item ${isSelected ? "is-selected" : ""}`}
                type="button"
                key={contact.tg_id}
                onClick={() => setSelectedId(contact.tg_id)}
                role="option"
                aria-selected={isSelected}
              >
                <span className="contact-picker__avatar" aria-hidden="true">{contact.name.slice(0, 1).toUpperCase()}</span>
                <span className="contact-picker__person">
                  <strong>{contact.name}</strong>
                  <small>{contact.username ? `@${contact.username} · ` : ""}TG {contact.tg_id}</small>
                </span>
                {isSelected && <Check size={19} strokeWidth={2.6} aria-label="Выбран" />}
              </button>
            );
          }) : (
            <div className="contact-picker__empty">
              {contacts.length ? "По этому запросу контактов нет." : "Новых контактов пока нет. Попросите человека написать боту /start."}
            </div>
          )}
        </div>

        <footer className="contact-picker__actions">
          <span>{selectedContact ? `Выбран: ${selectedContact.name}` : "Выберите один контакт"}</span>
          <div>
            <Button type="button" variant="soft" onClick={onClose}>Отмена</Button>
            <Button type="button" icon={Check} disabled={!selectedContact} onClick={() => onSelect(selectedContact)}>
              Выбрать
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

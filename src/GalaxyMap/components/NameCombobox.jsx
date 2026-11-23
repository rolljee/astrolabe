import React, { useId, useState } from 'react';
import { X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

// A search field that offers a short list of matches while something is being
// typed (an ARIA combobox: arrows move, Enter picks, Escape closes). Nothing
// is listed before typing, so a huge roster never drops a wall of names on the
// map. Picking hands the match over and empties the field for the next one.
//
// `suggest(query)` returns `[{ key, item, content }]`; `findExact(query)` lets
// Enter pick a name typed in full; `missing(query)` explains an empty list.
function NameCombobox({ label, Icon, placeholder, disabled, suggest, findExact, missing, onPick }) {
	const { t } = useI18n();
	const listId = useId();
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const typed = query.trim().length > 0;

	const suggestions = suggest(query);
	const expanded = open && suggestions.length > 0;
	const optionId = (index) => `${listId}-${index}`;

	const type = (value) => {
		setQuery(value);
		setOpen(true);
		setActive(-1);
	};

	const pick = (item) => {
		onPick(item);
		setQuery('');
		setOpen(false);
		setActive(-1);
	};

	const handleKeyDown = (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!suggestions.length) return;
			event.preventDefault();
			setOpen(true);
			const step = event.key === 'ArrowDown' ? 1 : -1;
			setActive((current) => (current + step + suggestions.length) % suggestions.length);
		} else if (event.key === 'Enter') {
			// The highlighted match, the only one left, or a name typed in full.
			const item =
				(expanded ? suggestions[active]?.item : null) ??
				(suggestions.length === 1 ? suggestions[0].item : null) ??
				findExact(query);
			if (item) {
				event.preventDefault();
				pick(item);
			}
		} else if (event.key === 'Escape' && expanded) {
			event.preventDefault();
			setOpen(false);
			setActive(-1);
		}
	};

	return (
		<div className="gm-locator-combo">
			<div className="gm-locator-input">
				<label className="field gm-locator-field">
					<span className="field-label">
						<Icon size={18} aria-hidden="true" />
						{label}
					</span>
					<input
						type="search"
						role="combobox"
						autoComplete="off"
						spellCheck={false}
						aria-autocomplete="list"
						aria-controls={listId}
						aria-expanded={expanded}
						aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
						placeholder={placeholder}
						disabled={disabled}
						value={query}
						onChange={(event) => type(event.target.value)}
						onKeyDown={handleKeyDown}
						onFocus={() => setOpen(true)}
						onBlur={() => setOpen(false)}
					/>
				</label>
				{typed && (
					<button
						type="button"
						className="btn-text gm-locator-clear"
						aria-label={`${t('gm.player.clear')} — ${label}`}
						title={t('gm.player.clear')}
						onClick={() => type('')}
					>
						<X size={15} aria-hidden="true" />
					</button>
				)}
			</div>
			<ul id={listId} role="listbox" aria-label={label} className="gm-suggest" hidden={!expanded}>
				{expanded &&
					suggestions.map(({ key, item, content }, index) => (
						<li
							key={key}
							id={optionId(index)}
							role="option"
							aria-selected={index === active}
							className={`gm-suggest-option${index === active ? ' is-active' : ''}`}
							// mousedown, not click: the field would blur first and close the list.
							onMouseDown={(event) => {
								event.preventDefault();
								pick(item);
							}}
							onMouseEnter={() => setActive(index)}
						>
							{content}
						</li>
					))}
			</ul>
			{typed && suggestions.length === 0 && <p className="help">{missing(query)}</p>}
		</div>
	);
}

export default NameCombobox;

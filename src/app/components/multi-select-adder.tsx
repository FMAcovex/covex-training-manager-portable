"use client";

import { useMemo, useState } from "react";

export type MultiSelectOption = {
  id: string;
  label: string;
  description?: string;
  searchText?: string;
  filterValue?: string;
};

export type MultiSelectFilter = {
  value: string;
  label: string;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .trim();

export function MultiSelectAdder({
  name,
  options,
  selectedIds,
  onChange,
  placeholder = "Seleccionar",
  emptyMessage = "No hay opciones disponibles",
  disabled = false,
  searchPlaceholder = "Buscar…",
  filters = [],
  filterPlaceholder = "Todos",
  enableSelectAll = false,
}: {
  name: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  filters?: MultiSelectFilter[];
  filterPlaceholder?: string;
  enableSelectAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = selectedIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is MultiSelectOption => Boolean(option));

  const visible = useMemo(() => {
    const term = normalize(search);
    return options.filter((option) => {
      if (filter && option.filterValue !== filter) return false;
      if (!term) return true;
      return normalize([option.label, option.description, option.searchText].filter(Boolean).join(" ")).includes(term);
    });
  }, [filter, options, search]);

  const visibleIds = visible.map((option) => option.id);
  const unselectedVisibleIds = visibleIds.filter((id) => !selected.has(id));

  function toggle(id: string) {
    if (selected.has(id)) onChange(selectedIds.filter((selectedId) => selectedId !== id));
    else onChange([...selectedIds, id]);
  }

  function selectVisible() {
    if (!unselectedVisibleIds.length) return;
    onChange([...selectedIds, ...unselectedVisibleIds]);
  }

  function clearSelection() {
    onChange([]);
  }

  return <div className="multi-select-adder">
    <button
      className="multi-select-trigger"
      type="button"
      disabled={disabled}
      aria-expanded={open}
      aria-controls={`${name}-options`}
      onClick={() => setOpen((value) => !value)}
    >
      <span>{selectedIds.length ? `${selectedIds.length} seleccionado${selectedIds.length === 1 ? "" : "s"}` : placeholder}</span>
      <span aria-hidden="true">{open ? "▲" : "▼"}</span>
    </button>

    {open && !disabled && <div className="multi-select-panel" id={`${name}-options`}>
      <div className="multi-select-search-row">
        <input
          name={name}
          type="search"
          autoComplete="off"
          value={search}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        />
        {filters.length > 0 && <select aria-label="Filtrar opciones" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">{filterPlaceholder}</option>
          {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>}
      </div>

      <div className="multi-select-panel-actions">
        <span>{visible.length} resultado{visible.length === 1 ? "" : "s"}</span>
        <div>
          {enableSelectAll && visible.length > 0 && <button className="text-action" type="button" disabled={!unselectedVisibleIds.length} onClick={selectVisible}>
            Seleccionar {unselectedVisibleIds.length ? `visibles (${unselectedVisibleIds.length})` : "visibles"}
          </button>}
          {selectedIds.length > 0 && <button className="text-action" type="button" onClick={clearSelection}>Quitar todos</button>}
          <button className="text-action" type="button" onClick={() => setOpen(false)}>Cerrar</button>
        </div>
      </div>

      <div className="multi-select-options" role="listbox" aria-multiselectable="true">
        {visible.map((option) => <label className={`multi-select-option${selected.has(option.id) ? " selected" : ""}`} key={option.id}>
          <input type="checkbox" checked={selected.has(option.id)} onChange={() => toggle(option.id)} />
          <span>
            <strong>{option.label}</strong>
            {option.description && <small>{option.description}</small>}
          </span>
        </label>)}
        {visible.length === 0 && <p className="multi-select-empty">{options.length ? "No hay resultados con esos filtros." : emptyMessage}</p>}
      </div>
    </div>}

    {selectedOptions.length > 0 && <div className="selection-summary">
      <div className="selection-summary-heading">
        <span>{selectedOptions.length} seleccionado{selectedOptions.length === 1 ? "" : "s"}</span>
        {!disabled && selectedOptions.length > 1 && <button className="text-action" type="button" onClick={clearSelection}>Quitar todos</button>}
      </div>
      <div className="selection-chips">
        {selectedOptions.map((option) => <span className="selection-chip" key={option.id}>
          <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          {!disabled && <button type="button" aria-label={`Quitar ${option.label}`} onClick={() => toggle(option.id)}>×</button>}
        </span>)}
      </div>
    </div>}
  </div>;
}

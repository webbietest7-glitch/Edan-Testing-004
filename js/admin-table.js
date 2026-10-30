const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export function renderEmptyRow(tbody, colspan, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.className = "admin__table-empty";
  cell.textContent = text;
  row.append(cell);
  tbody.replaceChildren(row);
}

export function createRow(cells) {
  const row = document.createElement("tr");
  cells.forEach(text => {
    const cell = document.createElement("td");
    cell.textContent = text;
    row.append(cell);
  });
  return row;
}

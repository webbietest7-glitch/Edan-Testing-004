import { supabase } from "./supabase-client.js";
import { formatDay, localIsoDate, renderEmptyRow, createRow, setMessageText } from "./admin-table.js";

const BLOCK_LIMIT = 100;

const roomsBody = document.getElementById("roomsBody");
const roomForm = document.getElementById("roomForm");
const roomName = document.getElementById("roomName");
const roomError = document.getElementById("roomError");
const blockForm = document.getElementById("blockForm");
const blockRoom = document.getElementById("blockRoom");
const blockStart = document.getElementById("blockStart");
const blockEnd = document.getElementById("blockEnd");
const blockReason = document.getElementById("blockReason");
const blockError = document.getElementById("blockError");
const blockSubmit = document.getElementById("blockSubmit");
const blocksBody = document.getElementById("blocksBody");

export async function fetchRooms() {
  const { data, error } = await supabase
    .from("stay_rooms")
    .select("id, name, is_active")
    .order("name");

  if (error) throw error;
  return data;
}

function fillRoomOptions(rooms) {
  blockRoom.replaceChildren(...rooms.map(room => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.is_active ? room.name : `${room.name} (closed)`;
    return option;
  }));
}

function renderRoomRow(room) {
  const row = createRow([room.name, room.is_active ? "Open for bookings" : "Closed"]);
  const actionCell = document.createElement("td");
  const button = document.createElement("button");

  button.type = "button";
  button.className = "admin__button admin__button--small";
  button.textContent = room.is_active ? "Close room" : "Reopen room";
  button.dataset.roomId = room.id;
  button.dataset.nextActive = String(!room.is_active);

  actionCell.append(button);
  row.append(actionCell);
  return row;
}

async function loadRooms() {
  const rooms = await fetchRooms();

  if (!rooms.length) {
    renderEmptyRow(roomsBody, 3, "No rooms yet. Add each room's name below.");
    blockRoom.replaceChildren();
    return;
  }

  roomsBody.replaceChildren(...rooms.map(renderRoomRow));
  fillRoomOptions(rooms);
}

function renderBlockRow(block) {
  const row = createRow([
    block.stay_rooms?.name ?? "—",
    `${formatDay(block.starts_on)} to ${formatDay(block.ends_on)}`,
    block.reason || "—"
  ]);

  const actionCell = document.createElement("td");
  const button = document.createElement("button");

  button.type = "button";
  button.className = "admin__button admin__button--small admin__button--danger";
  button.textContent = "Remove";
  button.dataset.blockId = block.id;

  actionCell.append(button);
  row.append(actionCell);
  return row;
}

async function loadBlocks() {
  const { data, error } = await supabase
    .from("stay_room_blocks")
    .select("id, starts_on, ends_on, reason, stay_rooms(name)")
    .gte("ends_on", localIsoDate())
    .order("starts_on")
    .limit(BLOCK_LIMIT);

  if (error) throw error;

  if (!data.length) {
    renderEmptyRow(blocksBody, 4, "No upcoming blocked dates.");
    return;
  }

  blocksBody.replaceChildren(...data.map(renderBlockRow));
}

export async function loadAvailability() {
  await Promise.all([loadRooms(), loadBlocks()]);
}

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessageText(roomError, "");

  const name = roomName.value.trim();

  if (!name) {
    setMessageText(roomError, "Enter a name for the room.");
    return;
  }

  const { error } = await supabase.from("stay_rooms").insert({ name });

  if (error) {
    setMessageText(
      roomError,
      error.code === "23505" ? "A room with that name already exists." : error.message
    );
    return;
  }

  roomForm.reset();
  await loadRooms();
});

roomsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-room-id]");
  if (!button) return;

  button.disabled = true;
  setMessageText(roomError, "");

  const { error } = await supabase
    .from("stay_rooms")
    .update({ is_active: button.dataset.nextActive === "true" })
    .eq("id", button.dataset.roomId);

  if (error) {
    setMessageText(roomError, error.message);
    button.disabled = false;
    return;
  }

  await loadRooms();
});

blockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessageText(blockError, "");

  if (!blockStart.value || !blockEnd.value || blockEnd.value <= blockStart.value) {
    setMessageText(blockError, "The end date must be after the start date.");
    return;
  }

  blockSubmit.disabled = true;

  const { error } = await supabase.rpc("admin_block_room", {
    p_room_id: blockRoom.value,
    p_starts_on: blockStart.value,
    p_ends_on: blockEnd.value,
    p_reason: blockReason.value
  });

  blockSubmit.disabled = false;

  if (error) {
    setMessageText(blockError, error.message);
    return;
  }

  blockForm.reset();
  await loadBlocks();
});

blocksBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-block-id]");
  if (!button) return;

  if (!window.confirm("Remove this blocked period? The room will be open for bookings on these dates.")) return;

  button.disabled = true;

  const { error } = await supabase
    .from("stay_room_blocks")
    .delete()
    .eq("id", button.dataset.blockId);

  if (error) {
    setMessageText(blockError, error.message);
    button.disabled = false;
    return;
  }

  await loadBlocks();
});

import { fetchRoomAvailability } from "./stay-api.js";

(() => {
  const modal = document.getElementById("stayBookingModal");
  const form = document.getElementById("stayBookingForm");

  if (!modal || !form) return;

  const checkIn = document.getElementById("stayCheckIn");
  const checkOut = document.getElementById("stayCheckOut");
  const guests = document.getElementById("stayGuests");
  const rateInputs = form.querySelectorAll('input[name="stayRate"]');
  const nightCount = document.getElementById("stayNightCount");
  const totalOutput = document.getElementById("stayTotal");
  const errorOutput = document.getElementById("stayBookingError");
  const resultsOutput = document.getElementById("stayResults");
  const submitButton = form.querySelector('[type="submit"]');

  const rates = {
    room: 650,
    breakfast: 700
  };

  const rateLabels = {
    room: "Room only",
    breakfast: "With breakfast"
  };

  const money = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0
  });

  let availabilityRequest = 0;

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function selectedRate() {
    return form.querySelector('input[name="stayRate"]:checked')?.value || "room";
  }

  function calculateNights() {
    if (!checkIn.value || !checkOut.value) return 0;

    const start = new Date(`${checkIn.value}T12:00:00`);
    const end = new Date(`${checkOut.value}T12:00:00`);

    return Math.round((end - start) / 86400000);
  }

  function updateSummary() {
    const nights = calculateNights();
    const price = rates[selectedRate()];

    if (nights < 1) {
      nightCount.textContent = "Choose valid dates";
      totalOutput.textContent = `${money.format(price)} / night`;
      return;
    }

    nightCount.textContent =
      `${nights} ${nights === 1 ? "night" : "nights"}`;

    totalOutput.textContent = money.format(nights * price);
  }

  function showError(message) {
    errorOutput.textContent = message;
    errorOutput.hidden = false;
  }

  function clearError() {
    errorOutput.textContent = "";
    errorOutput.hidden = true;
  }

  function clearResults() {
    availabilityRequest += 1;
    resultsOutput.replaceChildren();
    resultsOutput.hidden = true;
  }

  function setChecking(isChecking) {
    submitButton.disabled = isChecking;
    submitButton.textContent = isChecking ? "Checking availability…" : "Check availability";
  }

  function renderMessage(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "stay-results__message";
    paragraph.textContent = text;
    resultsOutput.replaceChildren(paragraph);
    resultsOutput.hidden = false;
  }

  function renderRooms(rooms, nights, rate) {
    const total = nights * rates[rate];
    const nightsLabel = `${nights} ${nights === 1 ? "night" : "nights"}`;

    const title = document.createElement("h3");
    title.className = "stay-results__title";
    title.textContent = rooms.length === 1
      ? "1 room is free for your dates"
      : `${rooms.length} rooms are free for your dates`;

    const list = document.createElement("ul");
    list.className = "stay-results__list";

    rooms.forEach((room) => {
      const item = document.createElement("li");
      item.className = "stay-results__item";

      const copy = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = room.name;

      const detail = document.createElement("small");
      detail.textContent = `${rateLabels[rate]} · ${nightsLabel}`;

      const price = document.createElement("span");
      price.className = "stay-results__price";
      price.textContent = money.format(total);

      copy.append(name, detail);
      item.append(copy, price);
      list.append(item);
    });

    resultsOutput.replaceChildren(title, list);
    resultsOutput.hidden = false;
  }

  function updateCheckoutMinimum() {
    if (!checkIn.value) return;

    const nextDay = new Date(`${checkIn.value}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);

    checkOut.min = localDateString(nextDay);

    if (checkOut.value && checkOut.value <= checkIn.value) {
      checkOut.value = "";
    }

    updateSummary();
  }

  const today = localDateString(new Date());
  checkIn.min = today;
  checkOut.min = today;

  document.querySelectorAll(".stay-book-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      clearError();
      clearResults();

      const todayValue = localDateString(new Date());
      checkIn.min = todayValue;

      if (!checkIn.value || checkIn.value < todayValue) {
        checkIn.value = "";
      }

      updateCheckoutMinimum();
      updateSummary();
      modal.showModal();
    });
  });

  document.querySelectorAll("[data-close-stay-modal]").forEach((button) => {
    button.addEventListener("click", () => modal.close());
  });

  checkIn.addEventListener("change", () => {
    clearResults();
    updateCheckoutMinimum();
  });
  checkOut.addEventListener("change", () => {
    clearResults();
    updateSummary();
  });
  guests.addEventListener("change", clearError);

  rateInputs.forEach((input) => {
    input.addEventListener("change", () => {
      clearResults();
      updateSummary();
    });
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const nights = calculateNights();

    if (!checkIn.value || !checkOut.value || nights < 1) {
      showError("Choose a valid check-in date and a check-out date at least one night later.");
      return;
    }

    if (checkIn.value < localDateString(new Date())) {
      showError("Your check-in date cannot be in the past.");
      return;
    }

    const rate = selectedRate();
    const request = ++availabilityRequest;

    setChecking(true);

    try {
      const rooms = await fetchRoomAvailability(checkIn.value, checkOut.value);
      if (request !== availabilityRequest) return;

      if (rooms.length === 0) {
        renderMessage("Sorry, no rooms are free for these dates. Try different dates.");
      } else {
        renderRooms(rooms, nights, rate);
      }
    } catch (error) {
      if (request !== availabilityRequest) return;
      clearResults();
      showError(error.message);
    } finally {
      if (request === availabilityRequest) setChecking(false);
    }
  });

  updateSummary();
})();

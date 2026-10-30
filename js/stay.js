
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

  const rates = {
    room: 650,
    breakfast: 700
  };

  const money = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0
  });

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

  checkIn.addEventListener("change", updateCheckoutMinimum);
  checkOut.addEventListener("change", updateSummary);
  guests.addEventListener("change", clearError);

  rateInputs.forEach((input) => {
    input.addEventListener("change", updateSummary);
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  form.addEventListener("submit", (event) => {
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

    const bookingDraft = {
      room: document.getElementById("stayRoom").value,
      checkIn: checkIn.value,
      checkOut: checkOut.value,
      guests: Number(guests.value),
      rate: selectedRate(),
      nights,
      pricePerNight: rates[selectedRate()],
      estimatedTotal: nights * rates[selectedRate()],
      currency: "GHS"
    };

    // Frontend demonstration only.
    // A real implementation must securely preserve this booking
    // through the account/login flow using a backend.
    try {
      sessionStorage.setItem(
        "edanStayBookingDraft",
        JSON.stringify(bookingDraft)
      );
    } catch {
      showError("Your browser couldn't save this selection. Please try again.");
      return;
    }

    showError(
      "Your dates and estimated total are ready. Account creation, real availability checks and payment need to be connected before booking can continue."
    );
  });

  updateSummary();
})();

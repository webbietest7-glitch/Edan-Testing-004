import {
  createBookingHold,
  fetchBookingStatus,
  initializeStayPayment,
  verifyStayPayment
} from "./stay-api.js";

const dateFormat = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

function formatDate(isoDate) {
  return dateFormat.format(new Date(`${isoDate}T12:00:00`));
}

export function createStayCheckout(elements) {
  const {
    form,
    nameInput,
    emailInput,
    phoneInput,
    errorOutput,
    roomOutput,
    datesOutput,
    totalOutput,
    payButton,
    statusTitle,
    statusText,
    statusAction,
    showStep,
    closeModal,
    formatMoney
  } = elements;

  let selection = null;

  function setError(message) {
    errorOutput.textContent = message;
    errorOutput.hidden = false;
  }

  function clearError() {
    errorOutput.textContent = "";
    errorOutput.hidden = true;
  }

  function setPaying(isPaying) {
    payButton.disabled = isPaying;
    payButton.textContent = isPaying ? "Please wait…" : "Continue to payment";
  }

  function setStatus(title, text, action) {
    statusTitle.textContent = title;
    statusText.textContent = text;
    statusAction.hidden = !action;
    statusAction.textContent = action?.label ?? "";
    statusAction.onclick = action ? action.onClick : null;
  }

  function openCheckoutWindow(accessCode, bookingId) {
    if (!window.PaystackPop) {
      setStatus(
        "Payment window unavailable",
        "The secure payment window could not load. Check your connection and try again.",
        { label: "Try again", onClick: () => startPayment(bookingId) }
      );
      return;
    }

    setStatus(
      "Complete your payment",
      "Finish paying in the secure Paystack window. Your room is held for 15 minutes.",
      null
    );

    const popup = new window.PaystackPop();
    popup.resumeTransaction(accessCode, {
      onSuccess: () => checkStatus(bookingId),
      onCancel: () => setStatus(
        "Payment not completed",
        "Your room is still held for a short time. Continue to pay to finish your booking.",
        { label: "Continue to payment", onClick: () => startPayment(bookingId) }
      ),
      onError: (error) => setStatus(
        "Payment could not be completed",
        error?.message || "Please try again.",
        { label: "Try again", onClick: () => startPayment(bookingId) }
      )
    });
  }

  async function startPayment(bookingId) {
    showStep("status");
    setStatus("Opening secure payment", "Please wait while we prepare your payment.", null);

    try {
      const { access_code: accessCode } = await initializeStayPayment(bookingId);
      if (typeof accessCode !== "string" || !accessCode) {
        throw new Error("Payment could not be started. Please try again.");
      }
      openCheckoutWindow(accessCode, bookingId);
    } catch (error) {
      setStatus(
        "Payment could not start",
        error.message,
        { label: "Try again", onClick: () => startPayment(bookingId) }
      );
    }
  }

  function describeBooking(booking) {
    const reference = `Booking reference ${booking.booking_reference}.`;

    if (booking.status === "confirmed") {
      return {
        title: "Your stay is confirmed",
        text: `${reference} Check-in ${formatDate(booking.check_in)} from 3:00 PM, check-out ${formatDate(booking.check_out)} by 11:00 AM. Total paid ${formatMoney(booking.total_ghs)}.`,
        action: { label: "Close", onClick: closeModal }
      };
    }

    if (booking.status === "pending_payment") {
      return {
        title: "Payment not confirmed yet",
        text: `${reference} We haven't received confirmation from Paystack yet. Wait a moment, then check again.`,
        action: { label: "Check again", onClick: () => checkStatus(booking.id) }
      };
    }

    return {
      title: "This booking didn't go through",
      text: `${reference} The payment wasn't completed, so the room has been released. Choose your dates again to book.`,
      action: { label: "Choose dates", onClick: () => showStep("dates") }
    };
  }

  async function checkStatus(bookingId) {
    showStep("status");
    setStatus("Checking your payment", "This only takes a moment.", null);

    try {
      await verifyStayPayment(bookingId);
      const booking = await fetchBookingStatus(bookingId);
      if (!booking) {
        throw new Error("We couldn't find this booking on your account.");
      }

      const { title, text, action } = describeBooking(booking);
      setStatus(title, text, action);
    } catch (error) {
      setStatus(
        "We couldn't check your booking",
        error.message,
        { label: "Check again", onClick: () => checkStatus(bookingId) }
      );
    }
  }

  function openDetails(nextSelection, user) {
    selection = nextSelection;

    roomOutput.textContent = selection.room.name;
    datesOutput.textContent = `${formatDate(selection.checkIn)} to ${formatDate(selection.checkOut)}`;
    totalOutput.textContent = `${formatMoney(selection.total)} for ${selection.nights} ${selection.nights === 1 ? "night" : "nights"}`;

    nameInput.value = user?.user_metadata?.full_name ?? "";
    emailInput.value = user?.email ?? "";
    phoneInput.value = "";

    clearError();
    showStep("details");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    if (!selection) return;

    const guestName = nameInput.value.trim();
    const guestEmail = emailInput.value.trim();
    const guestPhone = phoneInput.value.trim();

    if (!guestName || !guestEmail || !guestPhone) {
      setError("Please enter your name, email address and phone number.");
      return;
    }

    setPaying(true);

    try {
      const booking = await createBookingHold({
        roomId: selection.room.id,
        checkIn: selection.checkIn,
        checkOut: selection.checkOut,
        guests: selection.guests,
        breakfastIncluded: selection.rate === "breakfast",
        guestName,
        guestEmail,
        guestPhone
      });

      await startPayment(booking.id);
    } catch (error) {
      setError(error.message);
    } finally {
      setPaying(false);
    }
  });

  return { openDetails, checkStatus };
}

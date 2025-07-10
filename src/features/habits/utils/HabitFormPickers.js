// Time-picker helpers for the Habits form
// Extracted and refactored from the legacy app.js so they can be reused by the modern ES modules.
//
// The markup structure (ids, classes) is expected to match the template currently
// residing in index.html (time-picker-btn, time-picker-popup, etc.).
// If the template changes, update the selectors here accordingly.

export function initializeTimePicker() {
  // ---------- Element references ----------
  const timePickerBtn = document.getElementById('time-picker-btn');
  const timePickerPopup = document.getElementById('time-picker-popup');
  const selectedTimeSpan = document.getElementById('selected-time');
  const hourSelect = document.getElementById('hour-select');
  const minuteSelect = document.getElementById('minute-select');

  const hourPicker = document.getElementById('hour-picker');
  const minutePicker = document.getElementById('minute-picker');

  // Abort early if mandatory nodes are missing (e.g. modal not rendered yet)
  if (!timePickerBtn || !timePickerPopup || !hourPicker || !minutePicker) {
    return; // Nothing to wire up
  }


  let tempHour = hourSelect ? hourSelect.value : '09';
  let tempMinute = minuteSelect ? minuteSelect.value : '00';

  // ---------- Helper functions ----------
  function getSelectedValueFromScroll(picker, optionClass) {
    const pickerRect = picker.getBoundingClientRect();
    const pickerCenter = pickerRect.top + pickerRect.height / 2;

    let closestOption = null;
    let closestDistance = Infinity;

    picker.querySelectorAll(`.${optionClass}`).forEach((option) => {
      const optionRect = option.getBoundingClientRect();
      const optionCenter = optionRect.top + optionRect.height / 2;
      const distance = Math.abs(pickerCenter - optionCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestOption = option;
      }
    });

    if (!closestOption) return null;
    const dataKey = optionClass.replace('-option', ''); // hour-option -> hour
    return closestOption.dataset[dataKey] ?? null;
  }

  function snapToNearestOption(picker, optionClass) {
    const pickerRect = picker.getBoundingClientRect();
    const pickerCenter = pickerRect.top + pickerRect.height / 2;

    let closestOption = null;
    let closestDistance = Infinity;

    picker.querySelectorAll(`.${optionClass}`).forEach((option) => {
      const optionRect = option.getBoundingClientRect();
      const optionCenter = optionRect.top + optionRect.height / 2;
      const distance = Math.abs(pickerCenter - optionCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestOption = option;
      }
    });

    // Snap only if the option is not already centered (reduces jitter)
    if (closestOption && closestDistance > 2) {
      closestOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function initializeInfiniteScroll() {
    // Build hour column (three identical 24-item sets) if not yet present.
    const hourContainer = document.getElementById('hour-options-container');
    if (hourContainer && hourContainer.childElementCount === 0) {
      for (let set = 0; set < 3; set++) {
        for (let h = 0; h < 24; h++) {
          const hour = h.toString().padStart(2, '0');
          const div = document.createElement('div');
          div.className = 'hour-option py-1 text-center text-sm transition-colors';
          div.setAttribute('data-hour', hour);
          div.textContent = hour;
          hourContainer.appendChild(div);
        }
      }
    }

    // Minutes column (build fresh each open for simplicity)
    const minuteContainer = document.getElementById('minute-options-container');
    if (!minuteContainer) return;

    minuteContainer.innerHTML = '';
    for (let set = 0; set < 3; set++) {
      for (let i = 0; i < 60; i++) {
        const minute = i.toString().padStart(2, '0');
        const div = document.createElement('div');
        div.className = 'minute-option py-1 text-center text-sm transition-colors';
        div.setAttribute('data-minute', minute);
        div.textContent = minute;
        minuteContainer.appendChild(div);
      }
    }
  }

  function handleInfiniteScroll(picker, totalItems) {
    const itemHeight = 28; // must match CSS (approx height per option)
    const scrollTop = picker.scrollTop;
    const setHeight = totalItems * itemHeight;

    // If scrolled near the beginning/end, jump to the middle set to fake infinity.
    if (scrollTop < setHeight * 0.1) {
      picker.scrollTop = scrollTop + setHeight;
    } else if (scrollTop > setHeight * 1.9) {
      picker.scrollTop = scrollTop - setHeight;
    }
  }

  function centerSelectedValues() {
    // Align the chosen hour/minute to the visual center (middle set in 3-set list)
    const hourOptions = hourPicker.querySelectorAll(`[data-hour="${tempHour}"]`);
    if (hourOptions.length >= 2) {
      hourOptions[1].scrollIntoView({ behavior: 'instant', block: 'center' });
    }

    const minuteOptions = minutePicker.querySelectorAll(`[data-minute="${tempMinute}"]`);
    if (minuteOptions.length >= 2) {
      minuteOptions[1].scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }

  function updateTimeFromScroll() {
    const newHour = getSelectedValueFromScroll(hourPicker, 'hour-option');
    const newMinute = getSelectedValueFromScroll(minutePicker, 'minute-option');

    if (newHour !== null) tempHour = newHour;
    if (newMinute !== null) tempMinute = newMinute;

    if (selectedTimeSpan) selectedTimeSpan.textContent = `${tempHour}:${tempMinute}`;
  }

  // ---------- Event wiring ----------
  timePickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    // Cache current hour/minute from hidden inputs each time we open
    if (hourSelect) tempHour = hourSelect.value;
    if (minuteSelect) tempMinute = minuteSelect.value;

    initializeInfiniteScroll();

    // Show popup
    timePickerPopup.classList.remove('hidden');

    // Delay centering so the popup has rendered
    setTimeout(centerSelectedValues, 10);
  });

  document.addEventListener('click', (e) => {
    // Close if click outside popup and button
    if (!timePickerPopup.contains(e.target) && !timePickerBtn.contains(e.target)) {
      if (!timePickerPopup.classList.contains('hidden')) {
        // Persist chosen time to hidden inputs
        if (hourSelect) hourSelect.value = tempHour;
        if (minuteSelect) minuteSelect.value = tempMinute;
        if (selectedTimeSpan) selectedTimeSpan.textContent = `${tempHour}:${tempMinute}`;

        timePickerPopup.classList.add('hidden');
      }
    }
  });

  // Prevent propagation for inside clicks
  timePickerPopup.addEventListener('click', (e) => e.stopPropagation());

  let hourScrollTimeout;
  let minuteScrollTimeout;

  hourPicker.addEventListener('scroll', () => {
    handleInfiniteScroll(hourPicker, 24);
    updateTimeFromScroll();

    clearTimeout(hourScrollTimeout);
    hourScrollTimeout = setTimeout(() => {
      snapToNearestOption(hourPicker, 'hour-option');
    }, 150);
  });

  minutePicker.addEventListener('scroll', () => {
    handleInfiniteScroll(minutePicker, 60);
    updateTimeFromScroll();

    clearTimeout(minuteScrollTimeout);
    minuteScrollTimeout = setTimeout(() => {
      snapToNearestOption(minutePicker, 'minute-option');
    }, 150);
  });
}

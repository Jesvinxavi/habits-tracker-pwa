// Target Section module – extracted from form.js
// Provides live example text and event wiring for Completion Target controls.

import { TARGET_UNITS, FREQUENCIES } from '../../utils/constants.js';
import { capitalize } from '../../utils/common.js';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildTargetUnitOptions() {
  const select = document.getElementById('target-unit-select');
  if (!select || select.dataset.enhanced) return;
  TARGET_UNITS.forEach((unit) => {
    const opt = document.createElement('option');
    opt.value = unit;
    opt.textContent = capitalize(unit);
    select.appendChild(opt);
  });
  select.dataset.enhanced = '1';
}

function buildTargetFrequencyOptions() {
  const select = document.getElementById('target-frequency-select');
  if (!select || select.dataset.enhanced) return;
  select.innerHTML = '';
  FREQUENCIES.forEach((freq) => {
    const opt = document.createElement('option');
    opt.value = freq;
    opt.textContent = capitalize(freq);
    select.appendChild(opt);
  });
  select.dataset.enhanced = '1';
}

export function updateTargetExample() {
  const textEl = document.getElementById('target-example-text');
  if (!textEl) return;
  const freq = document.getElementById('target-frequency-select')?.value || 'daily';
  const value = document.getElementById('target-value-input')?.value || '1';
  const unit = document.getElementById('target-unit-select')?.value || 'none';
  const unitText = unit === 'none' ? '' : ` ${unit}`;
  textEl.textContent = `Example: ${value}${unitText} each ${freq}`;
}

/* -------------------------------------------------------------------------- */
/*  Public initializer                                                         */
/* -------------------------------------------------------------------------- */

export function initTargetSection() {
  buildTargetFrequencyOptions();
  buildTargetUnitOptions();
  ['target-frequency-select', 'target-value-input', 'target-unit-select'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateTargetExample);
    document.getElementById(id)?.addEventListener('change', updateTargetExample);
  });

  updateTargetExample();
}

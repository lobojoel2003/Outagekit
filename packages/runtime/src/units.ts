/** Watt-hours stored in a battery rated in amp-hours at a nominal voltage. */
export function ampHoursToWattHours(ampHours: number, volts: number): number {
  return Math.max(0, ampHours) * Math.max(0, volts);
}

/** Amp-hours at a nominal voltage for a capacity in watt-hours. */
export function wattHoursToAmpHours(wattHours: number, volts: number): number {
  return volts > 0 ? Math.max(0, wattHours) / volts : 0;
}

/**
 * Real power in watts for a rating in volt-amperes. Many power supplies list
 * VA; a power factor of about 0.9 is typical for modern medical devices.
 */
export function voltAmpsToWatts(voltAmps: number, powerFactor = 0.9): number {
  return Math.max(0, voltAmps) * Math.min(1, Math.max(0, powerFactor));
}

/** Watts drawn by a device from its input voltage and current. */
export function wattsFromVoltsAmps(volts: number, amps: number): number {
  return Math.max(0, volts) * Math.max(0, amps);
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

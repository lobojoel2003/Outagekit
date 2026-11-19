/**
 * @outagekit/runtime: battery runtime math for electricity-dependent
 * medical equipment. MIT licensed.
 *
 * @packageDocumentation
 */
export type {
  Chemistry,
  Conditions,
  Load,
  PowerSource,
  Priority,
  RuntimeWarning,
  SourceKind,
  Supply,
  WarningCode,
  WarningSeverity,
} from './types.js';

export {
  CHEMISTRY,
  MIN_MODELLED_HEALTH,
  chemistryProfile,
  clamp,
  peukertFactor,
  stateOfHealth,
  temperatureFactor,
  type ChemistryProfile,
} from './chemistry.js';

export {
  PRIORITY_RANK,
  averageWatts,
  dutyCycleOf,
  isActive,
  nonNegative,
  quantityOf,
  runningWatts,
  summarizeLoads,
  type LoadSummary,
} from './loads.js';

export {
  DC_ADAPTER_EFFICIENCY,
  DEFAULT_TEMPERATURE_C,
  SOURCE_KIND_DEFAULTS,
  estimateRuntime,
  estimateSourceRuntime,
  resolveSource,
  type ResolvedSource,
  type RuntimeEstimate,
  type SourceRuntime,
} from './runtime.js';

export {
  leaveAfterHours,
  planLoadShedding,
  type LeaveOptions,
  type ShedOptions,
  type ShedPlan,
  type ShedStep,
} from './shed.js';

export {
  chargeReminder,
  daysBetween,
  estimateStoredCharge,
  rechargeHours,
  recommendedCheckIntervalDays,
  type ChargeReminder,
  type ChargeReminderInput,
  type DateInput,
  type StoredChargeInput,
} from './charge.js';

export {
  OXYGEN_CYLINDER_LITRES,
  oxygenCylinderHours,
  type CylinderInput,
  type OxygenCylinderSize,
} from './oxygen.js';

export {
  formatDuration,
  splitDuration,
  type DurationOptions,
  type DurationParts,
  type DurationStyle,
} from './format.js';

export {
  ampHoursToWattHours,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  voltAmpsToWatts,
  wattHoursToAmpHours,
  wattsFromVoltsAmps,
} from './units.js';

export {
  CATEGORY_LABELS,
  DEVICE_CATEGORIES,
  catalogUpdated,
  devices,
  displayName,
  findDevice,
  findPowerSource,
  loadFromCatalog,
  powerSources,
  settingOf,
  sourceFromCatalog,
  validateCatalog,
  validateDevices,
  validatePowerSources,
  type CatalogDevice,
  type CatalogPowerSource,
  type CatalogReference,
  type DeviceCategory,
  type DeviceSetting,
  type LoadOptions,
  type SourceOptions,
} from './catalog/index.js';

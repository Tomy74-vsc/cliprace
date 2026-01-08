export const adminErrorMessages = {
  VALIDATION_ERROR: (field: string, reason: string) => 
    `Validation error on ${field}: ${reason}`,
  INSUFFICIENT_BALANCE: (required: number, available: number) =>
    `Insufficient balance: required ${required}€, available ${available}€`,
  KYC_REQUIRED: () => 'KYC verification required for this action',
  INVALID_STATUS_TRANSITION: (from: string, to: string) =>
    `Cannot transition from status "${from}" to "${to}"`,
  MISSING_REQUIRED_FIELD: (field: string) =>
    `Required field "${field}" is missing`,
  INVALID_DATE_RANGE: () => 'Start date must be before end date',
  INSUFFICIENT_PERMISSIONS: (action: string) =>
    `Insufficient permissions to perform action: ${action}`,
  RESOURCE_NOT_FOUND: (resource: string, id: string) =>
    `${resource} with id "${id}" not found`,
};


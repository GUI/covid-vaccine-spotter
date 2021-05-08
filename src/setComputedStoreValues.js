/* eslint no-param-reassign: ["error", { ignorePropertyModificationsFor: ["patch"] }] */

module.exports = (patch) => {
  if (patch.brand === undefined && patch.provider_id) {
    patch.brand = patch.provider_id;
  }

  if (patch.brand_id === undefined && patch.provider_location_id) {
    patch.brand_id = patch.provider_location_id;
  }

  if (patch.appointments.length > 0) {
    patch.appointments_available = true;
  }

  if (
    patch.appointment_types === undefined ||
    patch.appointment_vaccine_types === undefined
  ) {
    const appointmentTypes = {};
    const appointmentVaccineTypes = {};

    for (const appointment of patch.appointments) {
      if (patch.appointment_types === undefined) {
        if (
          appointment.appointment_types &&
          appointment.appointment_types.length > 0
        ) {
          for (const appointmentType of appointment.appointment_types) {
            appointmentTypes[appointmentType] = true;
          }
        } else {
          appointmentTypes.unknown = true;
        }
      }

      if (patch.appointment_vaccine_types === undefined) {
        if (appointment.vaccine_types && appointment.vaccine_types.length > 0) {
          for (const vaccineType of appointment.vaccine_types) {
            appointmentVaccineTypes[vaccineType] = true;
          }
        } else {
          appointmentVaccineTypes.unknown = true;
        }
      }
    }

    if (patch.appointment_types === undefined) {
      patch.appointment_types = appointmentTypes;
    }

    if (patch.appointment_vaccine_types === undefined) {
      patch.appointment_vaccine_types = appointmentVaccineTypes;
    }
  }

  if (Object.keys(patch.appointment_types).length === 0) {
    patch.appointment_types.unknown = true;
  }

  if (Object.keys(patch.appointment_vaccine_types).length === 0) {
    patch.appointment_vaccine_types.unknown = true;
  }

  return patch;
};

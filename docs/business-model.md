# Business Model

## Core Business Entities

### Terrarium

- Represents one habitat managed by the breeder.
- Has a unique name, species label, optional notes, and configured min/max temperature and humidity.
- May exist without a connected device.

### Device

- Represents one HARDWARIO Core Module deployment.
- Identified by a stable `deviceExternalId`.
- Can be discovered before being assigned to a terrarium.

### Gateway

- Represents the laptop or Raspberry Pi running Node-RED.
- Owns the local persistence queue and sends authenticated HTTPS batches to the cloud.
- Can manage one live USB terrarium today and more later with more hardware or radio support.

### Sensor Reading

- A persisted climate sample for one device and optionally one terrarium.
- Contains temperature, humidity, acceleration, button and movement flags, sample count, and timestamp.

### Alert

- A domain signal raised when a reading violates configured terrarium limits.
- Active alerts are shown in the UI until the values return into range.

## Relationships

- One terrarium may have zero or one assigned device.
- One device may be connected to zero or one terrarium at a time.
- One gateway may have many devices in the long-term model.
- One terrarium has many readings and many alerts over time.

## Key Business Rules

- Terrarium names must be unique.
- Limits are persisted and editable.
- Current values and history must never mix between terrariums.
- Device assignment is exclusive.
- Unsent gateway data is retained indefinitely.
- Sent gateway data is retained for 24 hours on the gateway and permanently in the cloud database.

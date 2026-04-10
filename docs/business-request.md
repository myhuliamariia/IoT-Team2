# Business Request

## Problem

Breeders who manage multiple terrariums need a single application that keeps each habitat isolated from the others. They must be able to define acceptable temperature and humidity ranges per terrarium, track the latest values, review historical development, and immediately see when a device is disconnected.

## Goal

Deliver an internet-accessible MVP that connects:

- a HARDWARIO IoT node
- a Node-RED gateway
- a cloud application with backend and frontend

The solution must let the breeder create and manage multiple terrariums while preserving independent settings and telemetry streams.

## Primary Actor

- Breeder managing several terrariums with different species and care requirements

## Business Requirements

- Create at least two terrarium profiles.
- Prevent empty or duplicate terrarium names.
- Store per-terrarium temperature and humidity limits.
- Show current temperature and humidity for each terrarium separately.
- Show history in charts.
- Show disconnected state when a terrarium exists without a connected device.
- Keep gateway uploads resilient during internet outages.
- Authenticate the gateway before accepting telemetry.

## MVP Scope

- Temperature and humidity monitoring are the main business value.
- Accelerometer is used as a bonus tamper or movement indicator.
- Button is used as a manual maintenance or acknowledge signal.
- One USB-connected live node is supported immediately.
- The cloud and data model are prepared for additional devices and gateways later.

## Success Criteria

- Telemetry from the live node reaches the cloud application.
- The UI clearly separates terrariums and their histories.
- The gateway survives temporary cloud outages without data loss.
- The delivered documentation explains setup, operations, and extension to multiple terrariums.

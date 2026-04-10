#ifndef _APPLICATION_H
#define _APPLICATION_H

#include <math.h>
#include <stdio.h>
#include <string.h>
#include <twr.h>
#include <twr_button.h>
#include <twr_device_id.h>
#include <twr_led.h>
#include <twr_lis2dh12.h>
#include <twr_scheduler.h>
#include <twr_tag_humidity.h>
#include <twr_tmp112.h>
#include <twr_usb_cdc.h>

#define TERRARIUM_FIRMWARE_VERSION "1.0.0"
#define TERRARIUM_HARDWARE_REVISION "core-module-r2"
#define TERRARIUM_PUBLISH_INTERVAL_MS 10000
#define TERRARIUM_SENSOR_INTERVAL_MS 2000
#define TERRARIUM_ACCELEROMETER_INTERVAL_MS 500
#define TERRARIUM_MOTION_DELTA_G 0.18f
#define TERRARIUM_HUMIDITY_TAG_ENABLED 1
#define TERRARIUM_HUMIDITY_TAG_REVISION TWR_TAG_HUMIDITY_REVISION_R3

void application_init(void);

#endif

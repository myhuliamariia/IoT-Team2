#include "application.h"

static twr_led_t led;
static twr_button_t button;
static twr_tmp112_t temperature_sensor;
static twr_tag_humidity_t humidity_tag;
static twr_lis2dh12_t accelerometer;
static twr_scheduler_task_id_t publish_task_id;

static bool temperature_valid = false;
static bool humidity_valid = false;
static bool acceleration_valid = false;
static bool button_latched = false;
static bool movement_latched = false;

static float temperature_c = 0.0f;
static float humidity_pct = 0.0f;
static float acceleration_magnitude_g = 0.0f;
static float last_acceleration_magnitude_g = 0.0f;

static char device_external_id[32];

static void publish_task(void *param);
static void publish_now(void);

static void temperature_event_handler(twr_tmp112_t *self, twr_tmp112_event_t event, void *event_param)
{
    (void) self;
    (void) event_param;

    if (event != TWR_TMP112_EVENT_UPDATE)
    {
        temperature_valid = false;
        return;
    }

    temperature_valid = twr_tmp112_get_temperature_celsius(&temperature_sensor, &temperature_c);
}

static void humidity_event_handler(twr_tag_humidity_t *self, twr_tag_humidity_event_t event, void *event_param)
{
    (void) self;
    (void) event_param;

    if (event != TWR_TAG_HUMIDITY_EVENT_UPDATE)
    {
        humidity_valid = false;
        return;
    }

    humidity_valid = twr_tag_humidity_get_humidity_percentage(&humidity_tag, &humidity_pct);
}

static void accelerometer_event_handler(twr_lis2dh12_t *self, twr_lis2dh12_event_t event, void *event_param)
{
    (void) event_param;

    if (event != TWR_LIS2DH12_EVENT_UPDATE)
    {
        acceleration_valid = false;
        return;
    }

    twr_lis2dh12_result_g_t result;
    if (!twr_lis2dh12_get_result_g(self, &result))
    {
        acceleration_valid = false;
        return;
    }

    acceleration_magnitude_g = sqrtf(
        (result.x_axis * result.x_axis) +
        (result.y_axis * result.y_axis) +
        (result.z_axis * result.z_axis)
    );
    acceleration_valid = true;

    if (fabsf(acceleration_magnitude_g - last_acceleration_magnitude_g) > TERRARIUM_MOTION_DELTA_G)
    {
        movement_latched = true;
        publish_now();
    }

    last_acceleration_magnitude_g = acceleration_magnitude_g;
}

static void button_event_handler(twr_button_t *self, twr_button_event_t event, void *event_param)
{
    (void) self;
    (void) event_param;

    if (event == TWR_BUTTON_EVENT_PRESS)
    {
        button_latched = true;
        twr_led_pulse(&led, 80);
        publish_now();
    }
}

static void build_device_external_id(void)
{
    uint8_t raw_id[12];
    twr_device_id_get(raw_id, sizeof(raw_id));

    size_t offset = 0;
    offset += snprintf(device_external_id + offset, sizeof(device_external_id) - offset, "cm-");

    for (size_t index = 0; index < sizeof(raw_id) && offset + 2 < sizeof(device_external_id); index++)
    {
        offset += snprintf(device_external_id + offset, sizeof(device_external_id) - offset, "%02x", raw_id[index]);
    }
}

static void publish_now(void)
{
    twr_scheduler_plan_now(publish_task_id);
}

static void publish_task(void *param)
{
    (void) param;

    char temperature_buffer[16];
    char humidity_buffer[16];
    char acceleration_buffer[16];
    char payload[320];

    if (temperature_valid)
    {
        snprintf(temperature_buffer, sizeof(temperature_buffer), "%.2f", temperature_c);
    }
    else
    {
        snprintf(temperature_buffer, sizeof(temperature_buffer), "null");
    }

    if (humidity_valid)
    {
        snprintf(humidity_buffer, sizeof(humidity_buffer), "%.2f", humidity_pct);
    }
    else
    {
        snprintf(humidity_buffer, sizeof(humidity_buffer), "null");
    }

    if (acceleration_valid)
    {
        snprintf(acceleration_buffer, sizeof(acceleration_buffer), "%.2f", acceleration_magnitude_g);
    }
    else
    {
        snprintf(acceleration_buffer, sizeof(acceleration_buffer), "null");
    }

    snprintf(
        payload,
        sizeof(payload),
        "{\"deviceExternalId\":\"%s\",\"temperatureC\":%s,\"humidityPct\":%s,\"accelerationG\":%s,\"movementDetected\":%s,\"buttonPressed\":%s,\"firmwareVersion\":\"%s\",\"hardwareRevision\":\"%s\"}\r\n",
        device_external_id,
        temperature_buffer,
        humidity_buffer,
        acceleration_buffer,
        movement_latched ? "true" : "false",
        button_latched ? "true" : "false",
        TERRARIUM_FIRMWARE_VERSION,
        TERRARIUM_HARDWARE_REVISION
    );

    twr_uart_write(TWR_UART_UART2, (uint8_t *) payload, strlen(payload));
    twr_led_pulse(&led, 25);

    button_latched = false;
    movement_latched = false;
    twr_scheduler_plan_current_relative(TERRARIUM_PUBLISH_INTERVAL_MS);
}

void application_init(void)
{
    build_device_external_id();

    twr_led_init(&led, TWR_GPIO_LED, false, false);
    twr_led_set_mode(&led, TWR_LED_MODE_OFF);

    twr_uart_init(TWR_UART_UART2, TWR_UART_BAUDRATE_115200, TWR_UART_SETTING_8N1);
    twr_i2c_init(TWR_I2C_I2C0, TWR_I2C_SPEED_400_KHZ);

    twr_button_init(&button, TWR_GPIO_BUTTON, TWR_GPIO_PULL_DOWN, false);
    twr_button_set_event_handler(&button, button_event_handler, NULL);

    twr_tmp112_init(&temperature_sensor, TWR_I2C_I2C0, 0x48);
    twr_tmp112_set_event_handler(&temperature_sensor, temperature_event_handler, NULL);
    twr_tmp112_set_update_interval(&temperature_sensor, TERRARIUM_SENSOR_INTERVAL_MS);

#if TERRARIUM_HUMIDITY_TAG_ENABLED
    twr_tag_humidity_init(
        &humidity_tag,
        TERRARIUM_HUMIDITY_TAG_REVISION,
        TWR_I2C_I2C0,
        TWR_TAG_HUMIDITY_I2C_ADDRESS_DEFAULT
    );
    twr_tag_humidity_set_event_handler(&humidity_tag, humidity_event_handler, NULL);
    twr_tag_humidity_set_update_interval(&humidity_tag, TERRARIUM_SENSOR_INTERVAL_MS);
#endif

    twr_lis2dh12_init(&accelerometer, TWR_I2C_I2C0, 0x19);
    twr_lis2dh12_set_event_handler(&accelerometer, accelerometer_event_handler, NULL);
    twr_lis2dh12_set_update_interval(&accelerometer, TERRARIUM_ACCELEROMETER_INTERVAL_MS);

    publish_task_id = twr_scheduler_register(publish_task, NULL, TERRARIUM_PUBLISH_INTERVAL_MS);
}

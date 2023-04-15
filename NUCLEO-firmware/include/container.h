#ifndef ECF30AF8_18DD_4C39_A1A0_B7707B9C9482
#define ECF30AF8_18DD_4C39_A1A0_B7707B9C9482

#include <Arduino.h>

#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

typedef enum containerStateMachine
{
    def,
    waiting_for_auth,
    authenticated_opened,
    auth_failed,
    all_picked_up
} contFSM;

class container
{
public:
    contFSM state;
    char name[16];
    uint8_t unit_weight;
    int RGB_Pins[3];
    MFRC522 mfrc522;
    Servo myservo;
    uint8_t cid;
    int qntToPut; // if negative than qntToTake
    

    container(uint8_t _cid, int rfid_ss_pin, int rfid_rst_pin, int servo_pin);
    container();
    ~container();

    void init_unit(char *_name, uint8_t _unit_weight);
    void calibrate();
    void SetQnt(int qnt);

    bool RFID_checkFlag();
    void RFID_getID(char *id);

    void open();
    void wrongID();
    void close();
};



#endif /* ECF30AF8_18DD_4C39_A1A0_B7707B9C9482 */

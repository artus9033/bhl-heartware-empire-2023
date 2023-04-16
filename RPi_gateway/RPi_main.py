import serial
from typing import Dict, Any, List, Tuple, Optional
from time import sleep
import socketio
import os
import json
import sys
import os
import atexit

try:
    with open("/sys/firmware/devicetree/base/model", "r") as f:
        isRPI = ("raspberry" in f.read().lower())
except:
    # we must be on a non-linux then
    isRPI = False

if isRPI:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522



class ShelfSense:
    config: Dict[str, Any] = {}

    def __init__(self) -> None:
        self.ser_cons: Dict[str, serial.Serial] = {}
        self.unit_port_m: Dict[int, str] = {}

        configPath = os.path.abspath(os.path.join(os.path.dirname(__file__), "config.json"))

        assert os.path.exists(configPath)

        with open(configPath, "r") as f:
            self.config = json.load(f)
        
        try:
            with open("/sys/firmware/devicetree/base/model", "r") as f:
                self.isRPI = ("raspberry" in f.read().lower())
        except:
            # we must be on a non-linux then
            self.isRPI = False

        print(f"Running on a{'n ' if self.isRPI else ' NON-'}RPI")

        # self.unit_port_m = unit_port_m if self.isRPI else "COM8"

        self.sio = socketio.Client()

        @self.sio.event
        def connect():
            print("Connecting to SIO server")

            def authResultHandler(success: bool):
                if success:
                    print("Authentication successful")
                else:
                    print("Authentication FAILED")

                    sys.exit(-1)

            self.sio.emit("auth", data=(self.config["host"], self.config["pass"]), callback=authResultHandler)

        @self.sio.event
        def connect_error(data):
            print("Connecting to SIO server failed")

        @self.sio.event
        def put_in(order: Dict[str, int]):
            print("put_in received for:", order)

            read_rfid = self.rfidReader.read_id()
            self.loop_rfid_var = False


            def RfiD_callback(ath_confirm: bool):
                self.loop_rfid_var = ath_confirm

            self.sio.emit("checkUserAuthorizationForStation", data=read_rfid, callback=RfiD_callback)

            while not self.loop_rfid_var:
                read_rfid = self.rfidReader.read_id()
                self.sio.emit("checkUserAuthorizationForStation", data=read_rfid, callback=RfiD_callback)
                sleep(0.5)
                if not self.loop_rfid_var:
                    self.send_to_unit(chr(0x16) + chr(0x00))
                    print(chr(0x16) + chr(0x00))
                sleep(0.5)

            lastContainerId: Optional[int] = None
            lastAmount: Optional[int] = None
            realAmount: Optional[int] = None

            self.sio.emit("put_in_progress", data=("UNLOCKED", 0)) # unlocked signal, amount can be anything, ID must be null

            

            for id, targetAmount in order.items():
                realAmount = None # reset
                lastAmount = None

                id = int(id) # convert from str

                print(f"Setting LED indicating putting {targetAmount} items to container {id}")

                self.put_in(id, targetAmount)

                if lastContainerId is None:
                    lastContainerId = id

                self.attempt_shelf_open(id)

                while realAmount != targetAmount:

                    self.send_to_unit(chr(0x17) + chr(lastContainerId))
                    sleep(0.5)
                    connection = self.get_connection(lastContainerId)

                    red1 = connection.read()
                    red2 = connection.read()
                    red3 = connection.read()

                    if ord(red1) == 0xA3 and ord(red2) == lastContainerId:
                        realAmount = ord(red3)

                    if realAmount != lastAmount:
                        print(f"Put_in progress for container {id}: {realAmount}")
                        
                        self.sio.emit("put_in_progress", data=(id, realAmount))

                    lastAmount = realAmount # store for next iteration

                    sleep(0.4)

                sleep(5)
                self.send_to_unit(chr(0x18) + chr(lastContainerId))


            self.sio.emit("put_in_progress", data=(None, lastAmount)) # finished everything, amount should be valid, ID must be null to indicate finish

            sleep(1)

            return True

        @self.sio.event
        def take_out(order: Dict[str, int]):
            print("take_out received for:", order)

            sleep(2) #TODO -add RFiD check instead of sleep!!!!

            # TODO - only if RFID cjecks out execute below code

            lastContainerId: Optional[int] = None
            lastAmount: Optional[int] = None
            realAmount: Optional[int] = None

            self.sio.emit("take_out_progress", data=("UNLOCKED", 0)) # unlocked signal, amount can be anything, ID must be null

            for id, targetAmount in order.items():
                realAmount = None # reset
                lastAmount = None

                id = int(id) # convert from str

                print(f"Setting LED indicating taking {targetAmount} items from container {id}")

                self.take_out(id, targetAmount)

                if lastContainerId is None:
                    lastContainerId = id

                self.attempt_shelf_open(id)

                while realAmount != targetAmount:

                    self.send_to_unit(chr(0x17) + chr(lastContainerId))
                    sleep(0.5)
                    connection = self.get_connection(lastContainerId)

                    red1 = connection.read()
                    red2 = connection.read()
                    red3 = connection.read()

                    if ord(red1) == 0xA3 and ord(red2) == lastContainerId:
                        realAmount = ord(red3)

                    if realAmount != lastAmount:
                        print(f"take_out progress for container {id}: {realAmount}")
                        
                        self.sio.emit("take_out_progress", data=(id, realAmount))

                    lastAmount = realAmount # store for next iteration

                    sleep(0.4)

                sleep(5)
                self.send_to_unit(chr(0x18) + chr(lastContainerId))


            self.sio.emit("take_out_progress", data=(None, lastAmount)) # finished everything, amount should be valid, ID must be null to indicate finish

            sleep(1)

            return True

        @self.sio.event
        def initUnits(units: List[Dict]):
            result = True
            print("Initializing units:", units)
            try:
                pass
                for unit in units:
                    if unit["serialPath"] not in self.unit_port_m.values():
                        port = unit["serialPath"]
                        connection = serial.Serial(unit["serialPath"] if isRPI else 'COM8', baudrate=9600, timeout = 1)
                        self.ser_cons[port] = connection

                        sleep(1)

                        connection.write(bytes(chr(0x00), 'latin-1'))

                        sleep(5)

                        connection.timeout = 2
                        # for _ in range(100):
                        #     connection.read()
                            #print(connection.read())

                        # print(1)

                        cr = connection.read()

                        while cr != b'':
                            # print(cr)
                            cr = connection.read()
                        
                        while cr != b'':
                            # print(cr)
                            cr = connection.read()

                        
                        while cr != b'':
                            # print(cr)
                            cr = connection.read()

                        # print(2)

                        connection.write(bytes(chr(0x00), 'latin-1'))

                        connection.timeout = 1

                        connection.read()
                        connection.read()
                        connection.read()

                        while connection.read() != b'':
                            pass

                    self.unit_port_m[unit["id"]] = unit["serialPath"]

                    self.init_unit(unit_id=unit["id"], unit_name=unit["name"], unit_weight=unit["weight"])

                    # unit["errorMargin"] # TODO: HERE!


            except Exception as e:
                result = False
                print("Initialisation error", e)

            print(f"Initialisation result: {'' if result else 'un'}successful")

            return result

        @self.sio.event
        def disconnect():
            print("Disconnected with SIO server")

        @self.sio.event
        def calibrateContainer(containerId: int)-> bool:
            print(f"Calibration request for {containerId} received - beginning")

            result: bool = True
            try:
                self.calibrate_unit(containerId)
            except Exception as e:
                result = False
                print("Calibration error", e)

            print(f"Calibration result: {'' if result else 'un'}successful")
            
            return result
        
        self.sio.connect(f"ws://{self.config['apiHost']}:{self.config['apiPort']}")

        if isRPI:
            self.rfidReader = SimpleMFRC522()


    def init_unit(self, unit_id: int, unit_name: str, unit_weight: int):
        data_to_send = chr(0x10)
        data_to_send+=chr(unit_id)
        data_to_send+=unit_name
        data_to_send+=chr(0x00)*(16 - len(unit_name))
        data_to_send+=chr(unit_weight)

        self.send_to_unit(data_to_send)

    def calibrate_unit(self, unit_id: int):
        self.send_to_unit(chr(0x11) + chr(unit_id))
        sleep(1)
        self.send_to_unit(chr(0x18) + chr(unit_id))

    def take_out(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x12) + chr(unit_id) + chr(amount))

        #self.unit_opened(unit_id)

    def put_in(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x13) + chr(unit_id) + chr(amount))

        #self.unit_opened(unit_id) 

    ####### Private
    def get_connection(self, unit_id):
        return self.ser_cons[self.unit_port_m[unit_id]]

    def send_to_unit(self, data):
        connection = self.get_connection(ord(data[1]))
        connection.write(bytes(data, 'latin-1'))

        print(bytes(data, 'latin-1'))

        sleep(0.2)

        if data[0] == chr(0x11):
            sleep(1)

        cr = connection.read()

        print("!", cr)

        if cr == bytes(chr(0xA2), 'latin-1'):
            while True:
                cr = connection.read()
                print(cr)
                if cr == bytes(chr(0xAA), 'latin-1'):
                    break

        # print("e", cr)

        if bytes(chr(0xAA), 'latin-1') != cr:
            raise RuntimeError("Wrong ack recieved!")

    # def debug(self, unit_id):
    #     connection = self.get_connection(unit_id)
    #     cr = ord(connection.read())
    #     while cr != 0xA2:
    #         cr = ord(connection.read())

    #     for _ in range(64):
    #         cr = ord(connection.read())
    #         print(cr)

    def attempt_shelf_open(self, unit: int):
        self.send_to_unit(chr(0x15) + chr(unit)) # unlock the container

    #LEGACY FUNCTION    
    # def unit_opened(self, unit_id):
    #     connection = self.get_connection(unit_id)
    #     while True:
    #         cr = ord(connection.read())
    #         print(cr)
    #         #RFiD Auth
    #         if 0xA0 == cr:
    #             if unit_id == ord(connection.read()):
    #                 red_RFiD = ''
    #                 for _ in range(4):
    #                     red_RFiD += hex(ord(connection.read())).upper()[2:]
    #                 print(red_RFiD)
                    
    #                 if red_RFiD == "699F0464":
    #                     self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x01))
    #                 else:
    #                     self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x00))
    #         # Unit closed
    #         elif 0xA1 == cr:
    #             if unit_id == ord(connection.read()):
    #                 break



def cleanup():
    if isRPI:
        try:
            GPIO.cleanup()
        except:
            pass

atexit.register(cleanup)

ss = ShelfSense()

#ss.debug(1)



# ser = serial.Serial('COM8', baudrate=115200)


# while True:



# sleep(1)

# ser.write(bytes(chr(0x00), 'latin-1'))
# ser.timeout = 0.001
# for _ in range(201):
#     ser.read()
#     #print(connection.read())

# ser.timeout = 1

# #ser.write(bytes(chr(0x00), 'latin-1'))


# print(ser.read())
# print(ser.read())
# print(ser.read())

# ser.write(bytes(chr(0x10) + chr(0x01) + 'A'*15 + '\0' + chr(0x10), 'latin-1'))

# for _ in range(65):
#     print(ser.read())

# ser.close()


# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())


# ser.close()

# print()

# print(chr(0x30)*2)

# ss = ShelfSense()

#ss.debug(1)

#ss.put_in(0, 1)

# ss.ser_cons['COM7'].write(bytes(chr(0x69) + chr(0x9F), 'latin-1'))

# print(ss.ser_cons['COM7'].read())

# bb = b'\xA1'

# print(hex(ord(bb)).upper()[2:])
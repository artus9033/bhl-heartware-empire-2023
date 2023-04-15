import serial
from typing import Dict
from time import sleep


class ShelfSense:
    def __init__(self, unit_port_m: Dict[int, str]) -> None:
        self.ser_cons = {}

        for key, item in unit_port_m.items():

            connection = serial.Serial(item, baudrate=115200, timeout = 1)
            self.ser_cons[item] = connection

            sleep(1)

            connection.write(bytes(chr(0x00), 'latin-1'))
            connection.timeout = 0.001
            for _ in range(100):
                connection.read()
                #print(connection.read())

            connection.write(bytes(chr(0x00), 'latin-1'))

            connection.timeout = 1

            connection.read()
            connection.read()
            connection.read()


        # self.ser_cons = {} #{'COM7': serial.Serial('COM7', baudrate=115200), 
        #                  #'COM8': serial.Serial('COM8', baudrate=115200)}
        
        self.unit_port_m = unit_port_m

    def init_unit(self, unit_id: int, unit_name: str, unit_weight: int):
        data_to_send = chr(0x10)
        data_to_send+=chr(unit_id)
        data_to_send+=unit_name
        data_to_send+=chr(0x00)*(16 - len(unit_name))
        data_to_send+=chr(unit_weight)

        self.send_to_unit(data_to_send)

    def calibrate_unit(self, unit_id: int):
        self.send_to_unit(chr(0x11) + chr(unit_id))

    def take_out(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x12) + chr(unit_id) + chr(amount))

        self.unit_opened(unit_id)

    def put_in(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x13) + chr(unit_id) + chr(amount))

        self.unit_opened(unit_id) 

    ####### Private
    def get_connection(self, unit_id):
        return self.ser_cons[self.unit_port_m[unit_id]]

    def send_to_unit(self, data):
        connection = self.get_connection(ord(data[1]))
        #print(connection)

        #connection.readall()
        #connection.readline()

        # connection.timeout = 0.001
        # for _ in range(100):
        #     print(connection.read())

        connection.write(bytes(data, 'latin-1'))

        #print(bytes(data, 'latin-1'))

        cr = ord(connection.read())

        print(cr)

        if 0xAA != cr:
            raise RuntimeError("Wrong ack recieved!")
        
    def unit_opened(self, unit_id):
        connection = self.get_connection(unit_id)
        while True:
            cr = ord(connection.read())
            print(cr)
            #RFiD Auth
            if 0xA0 == cr:
                if unit_id == ord(connection.read()):
                    red_RFiD = ''
                    for _ in range(4):
                        red_RFiD += hex(ord(connection.read())).upper()[2:]
                    print(red_RFiD)
                    
                    if red_RFiD == "699F0464":
                        self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x01))
                    else:
                        self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x00))
            # Unit closed
            elif 0xA1 == cr:
                if unit_id == ord(connection.read()):
                    break




# ser = serial.Serial('COM8', baudrate=115200)

# sleep(1)

# ser.write(bytes(chr(0x00), 'latin-1'))
# ser.timeout = 0.001
# for _ in range(100):
#     ser.read()
#     #print(connection.read())

# ser.timeout = 1

# ser.write(bytes(chr(0x00), 'latin-1'))


# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())

# ser.write(bytes(chr(0x11) + chr(0x00), 'latin-1'))


# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())


# ser.close()

# print()

# print(chr(0x30)*2)

ss = ShelfSense({0: 'COM8'})

ss.put_in(0, 1)

# ss.ser_cons['COM7'].write(bytes(chr(0x69) + chr(0x9F), 'latin-1'))

# print(ss.ser_cons['COM7'].read())

# bb = b'\xA1'

# print(hex(ord(bb)).upper()[2:])
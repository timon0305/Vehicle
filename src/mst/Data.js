import {applySnapshot, flow, types} from "mobx-state-tree";
import {observable} from "mobx";
import {isEmpty} from 'lodash';
import {defNumber, defString, VehicleName, OfferRequestList, Notification, Doctor, Speciality, DoctorDetails} from './Types';
import 'mobx-react-lite/batchingForReactDom';
import * as Api from '@/Services/Api';
import {Alert} from "react-native";
import Config from '@/config/AppConfig';
import ReactNativeAN from "react-native-alarm-notification";
import __ from '@/assets/lang';

const tag = 'MST.Data';
let statusCode = 0;
const Data = types
  .model('Data', {
    offerRequestList: types.array(OfferRequestList),
    notifications: types.array(Notification),
    vehicleName: types.array(VehicleName),
    doctors: types.array(Doctor),
    specialities: types.array(Speciality),
    lastStatus: defNumber,
    selectedDoctorId: defString,
    selectedDoctor: types.array(DoctorDetails),
  })
  .views((self) => ({

    // get getDoctors() {
    //   return self.doctors;
    // },
    get getPills() {
      return self.pillReminders;
    },
    get getDoctors() {
      return self.doctors;
    },
    get getSelectedDoctor() {
      if (self.selectedDoctor && self.selectedDoctor.length > 0)
        return self.selectedDoctor[0];
      return null;
    }
  }))
  .actions((self) => {
    const _updateOfferList = (data) => {
      self.offerRequestList = data.offers;
    };

    const _updateVehicleName = (data) => [
        self.vehicleName = data.vehicles
    ]

    const _updateNotifications = (data) => {
      self.notifications = data.notifications;
    };

    const _updateSpecialities = (specialities) => {
      self.specialities = specialities;
    };

    const _updateDoctors = (data) => {
      let doctors = [];
      for (let doctor of data.doctors) {
        doctor.avatarUrl = Config.appBaseUrl + doctor.avatarUrl;
        doctors.push(doctor);
      }
      self.doctors = doctors;
    };

    const getPillReminders = flow(function* updatePillReminders(
      userToken
    ) {
      self.setProcessing(true);
      try {
        // const response = yield Api.getPillReminders(userToken);
        // const {ok, data} = response;
        // self.lastStatus = response.status;
        // console.log(tag, 'Response from GetPillReminders API', typeof response.status);
        // if (ok) {
        //   _updatePillReminders(data);
        // }

        const alarms = yield ReactNativeAN.getScheduledAlarms();
        let reminders = [];
        alarms.map((alarm, index) => {
          let temp1 = alarm.data.split(';;');
          const parsedTime = parseInt(temp1[3].split('==>')[1]);

          if (true || parsedTime > new Date().getTime()) {
            let reminder = {
              id: alarm.id.toString(),
              medicineName: temp1[2].split('==>')[1],
              dosage: temp1[0].split('==>')[1],
              frequency: temp1[1].split('==>')[1],
              timeToTake: parsedTime.toString(),
            };
            console.log(tag, `${index} :`, alarm);
            reminders.push(reminder);
          } else {
            // ReactNativeAN.deleteAlarm(alarm.id);
          }
        });
        _updatePillReminders(reminders);
      } catch (e) {
      } finally {
        self.setProcessing(false);
      }
    });

    const addPillReminder = flow(function* addPillReminder(
      userToken,
      medicineName,
      dosage,
      frequency,
      timeToTake
    ) {
      self.setProcessing(true);

      try {
        // const response = yield Api.addPillReminder(userToken, medicineName, dosage, frequency, timeToTake);
        // const {ok, data} = response;
        // self.lastStatus = response.status;
        // console.log(tag, 'Response from AddPillReminder API', data);
        // if (ok) {
        //   yield getPillReminders(userToken);
        // }

        for (const reminder of self.pillReminders) {
          if (parseInt(timeToTake) === parseInt(reminder.timeToTake)) {
            alert('A reminder already exists at that time.');
            self.setProcessing(false);
            return;
          }
        }

        const alarmNotifiData = {
          title: `${medicineName} - ${dosage}`,
          message: `It is time to take this pill, ${medicineName} - ${dosage}`,
          channel: 'pill_reminder',
          // loop_data: true,
          small_icon: 'ic_launcher',
          schedule_type: 'repeat',
          repeat_interval: 'daily',
          play_sound: true,
          data: {
            name: medicineName,
            dosage,
            frequency,
            dateTime: new Date(timeToTake).getTime().toString(),
          }
        };
        // ReactNativeAN.sendNotification(alarmNotifiData);
        const fireDate = ReactNativeAN.parseDate(timeToTake);
        console.log(fireDate);
        const alarm = yield ReactNativeAN.scheduleAlarm(
          {
            ...alarmNotifiData,
            fire_date: fireDate,
          });
        console.log(tag, 'Alarm Added', alarm);
        yield getPillReminders();
      } catch (e) {
        console.log(tag, 'Adding Pill Exception', e.message);
        alert(e.message);
      } finally {
        self.setProcessing(false);
      }
    });

    const deletePillReminder = flow(function* deletePillReminder(
      id
    ) {
      self.setProcessing(true);

      try {
        let reminders = self.pillReminders.slice(0).filter(reminder => reminder.id != parseInt(id));
        _updatePillReminders(reminders);

        ReactNativeAN.deleteRepeatingAlarm(parseInt(id));
      } catch (e) {
        console.log(tag, 'Adding Pill Exception', e.message)
      } finally {
        self.setProcessing(false);
      }
    });

    const getNotifications = flow(function* getNotifications(
      userToken,
    ) {
      self.setProcessing(true);
      try {
        const response = yield Api.getNotifications(userToken);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from GetNotifications API', data);
        if (ok) {
          _updateNotifications(data);
        }
        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {
      } finally {
        self.setProcessing(false);
      }
    });

    const setNotificationAsRead = flow(function* (userToken, notificationId) {
      self.setProcessing(true);
      // let notifications = self.notifications.slice(0).filter(item => item.id != notificationId);
      // _updateNotifications({notifications});
      try {
        const response = yield Api.setNotificationAsRead(userToken, notificationId);
        const {ok, data} = response;
        if (!data) {
          alert(__('can_not_connect_server'));
        }
        if (ok) {
          yield getNotifications(userToken);
        }
      } catch (e) {

      } finally {
        self.setProcessing(false);
      }
    });

    const getVehicleName = flow(function*  getVehicleName(
        userToken
    ) {
      self.setProcessing(true);

      try {
        console.log('user token', userToken)
        const response = yield Api.getVehicleName(userToken)
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log('get vehicle name=>', data.vehicles)
        if (ok) {
          _updateVehicleName(data)
        }
      } catch (e) {
        console.log('get vehicle name exception =>', e.message)
      } finally {
        self.setProcessing(false);
      }
    })

    const getOfferList = flow(function* getOfferList(
      userToken
    ) {
      self.setProcessing(true);

      try {
        const response = yield Api.getOfferList(userToken);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from offer list API', data);
        if (ok) {
          _updateOfferList(data);
        }
        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {
      } finally {
        self.setProcessing(false);
      }
    });

    const searchDoctors = flow(function* searchDoctors(
      userToken, name, speciality, address
    ) {
      self.setProcessing(true);

      try {
        const response = yield Api.searchDoctors(userToken, name, speciality, address);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from SearchDoctors API', data);
        if (ok) {
          _updateDoctors(data);
        }
        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {
      } finally {
        self.setProcessing(false);
      }
    });

    const selectDoctor = (id) => {
      self.selectedDoctorId = id;
    };

    const fetchDoctorById = flow(function* fetchDoctorById(userToken, doctorId) {
      try {
        const response = yield Api.fetchDoctorById(userToken, doctorId);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from DoctorByID API', data);
        if (ok) {
          let {doctor} = data;
          doctor.avatarUrl = Config.appBaseUrl + doctor.avatarUrl;
          for (let i = 0; i < doctor.reviews.length; i++) {
            doctor.reviews[i].author.avatarUrl = Config.appBaseUrl + doctor.reviews[i].author.avatarUrl;
          }
          self.selectedDoctor = [doctor];
        }

        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {

      } finally {
        self.setProcessing(false);
      }
    });

    const requestBook = flow(function* requestBook(
      userToken, doctorId, timestamp
    ) {
      try {
        const response = yield Api.requestBook(userToken, doctorId, timestamp);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from RequestBook API', data);
        if (ok) {
          // ReactNativeAN.sendNotification({
          //   title: `Booking Success`,
          //   message: `Your booking was successfully requested`,
          //   channel: 'Booking_Request',
          // });
        }
        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {

      } finally {
        self.setProcessing(false);
      }

    });

    const submitReview = flow(function* submitReview(
      userToken, doctorId, rating, description
    ) {
      self.setProcessing(true);
      try {
        const response = yield Api.submitReview(userToken, doctorId, rating, description);
        const {ok, data} = response;
        self.lastStatus = response.status;
        console.log(tag, 'Response from SubmitReview API', data);
        if (ok) {
          _updateDoctors(data);
          selectDoctor(doctorId);
        }
        if (!data) {
          alert(__('can_not_connect_server'));
        }
      } catch (e) {

      } finally {
        self.setProcessing(false);
      }

    });

    const sentPriceToClient = flow(function* sentPriceToClient(userToken, offerId, offerPrice) {
        self.setProcessing(true);
        try {
          const response = yield Api.sentPriceToClient(userToken, offerId, offerPrice)
          const {ok, data} = response;
          self.lastStatus = response.status;
          console.log('update after response--------', data.offers )
          if (ok) {
            _updateOfferList(data);
          }
          if (!data) {
            alert(__('can_not_connect_server'));
          }
        } catch (e) {
          console.log('SentPriceToClient Exception Error ', e.message)
        } finally {
          self.setProcessing(false)
        }
    })

    return {
      getVehicleName,
      getOfferList,
      sentPriceToClient,
      getPillReminders,
      addPillReminder,
      deletePillReminder,
      getNotifications,
      setNotificationAsRead,
      searchDoctors,
      selectDoctor,
      requestBook,
      submitReview,
      fetchDoctorById,
    }
  })
  .extend((self) => {
    const localState = observable.box(false);
    return {
      views: {
        get isProcessing() {
          return localState.get();
        },
      },
      actions: {
        setProcessing(value) {
          localState.set(value)
        },
      },
    };
  });

export default Data;

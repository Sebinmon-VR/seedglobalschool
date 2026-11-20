/**
 * SEED Global School: events calendar.
 * Source: Academic Calendar 2025–26 (public/docs/Academic-Calendar-2025-26.pdf).
 * To update for a new year, edit the dates/titles below (day, title, note, tag).
 * tag: 'celebration' | 'learning' | 'sports' | 'arts' | 'community' | 'milestone'
 */
export const CALENDAR_YEAR = '2025–26';

export const EVENTS = {
  Jun: [
    { day: '02', title: 'Opening Day', note: 'The new academic year begins', tag: 'milestone' },
    { day: '05', title: 'World Environment Day', note: 'Gardening and an agricultural university visit', tag: 'learning' },
    { day: '11', title: 'Montessori Opening Day', note: 'A warm welcome for our youngest Seedlers', tag: 'celebration' },
    { day: '19', title: 'Reading Day', note: 'Reading, story and poem writing competitions', tag: 'learning' },
    { day: '21', title: 'International Yoga Day', note: 'Yoga practice, yoga dance and Music Day', tag: 'sports' },
    { day: '26', title: 'Anti-Drug Day', note: 'Elocution and a students’ chain against drug abuse', tag: 'community' },
  ],
  Jul: [
    { day: '01', title: 'Doctors’ Day', note: 'An interaction with a doctor', tag: 'community' },
    { day: '02', title: 'School Parliament Election', note: 'Young leaders, real ballots', tag: 'learning' },
    { day: '05', title: 'Investiture Ceremony', note: 'Basheer Day, CCA inauguration and a SEED Talk', tag: 'milestone' },
    { day: '21', title: 'Moon Day', note: 'Presentation and visual display competition', tag: 'learning' },
    { day: '28', title: 'Nature Conservation Day', note: 'Caring for the world around us', tag: 'learning' },
  ],
  Aug: [
    { day: '04', title: 'Colours Day', note: 'A rainbow celebration in Pre-Primary', tag: 'celebration' },
    { day: '15', title: 'Independence Day', note: 'Programmes and a freedom parade', tag: 'celebration' },
    { day: '29', title: 'Onam & National Sports Day', note: 'A no-bag day of Onam fun', tag: 'celebration' },
    { day: '30', title: 'Teachers’ Day Celebration', note: 'Thanking the people who help us grow', tag: 'community' },
  ],
  Sep: [
    { day: '22', title: 'Class Magazine Release', note: 'Our young writers in print', tag: 'arts' },
    { day: '24', title: 'Field Trips', note: 'Learning beyond the classroom', tag: 'learning' },
    { day: '30', title: 'Primary Day Celebration', note: 'A day for our primary students', tag: 'celebration' },
  ],
  Oct: [
    { day: '01', title: 'Grandparents’ Day', note: 'Celebrations and an old-age home visit', tag: 'community' },
    { day: '08', title: 'KPSA Arts Fest', note: 'Two days on stage', tag: 'arts' },
    { day: '10', title: 'Postal Day', note: 'A visit to the post office', tag: 'learning' },
    { day: '11', title: 'Planetarium Visit', note: 'A study tour to the stars', tag: 'learning' },
    { day: '16', title: 'Food Day', note: 'SEED Talk and food celebrations', tag: 'celebration' },
    { day: '31', title: 'Pre-Primary Day', note: 'Our little ones take the spotlight', tag: 'celebration' },
  ],
  Nov: [
    { day: '01', title: 'Kerala Piravi', note: 'Celebrating Kerala’s birthday', tag: 'celebration' },
    { day: '14', title: 'Children’s Day', note: 'Short film release and celebrations', tag: 'celebration' },
    { day: '15', title: 'PTA Meeting & Open House', note: 'Parents and teachers together', tag: 'community' },
    { day: '22', title: 'Annual Sports Meet', note: 'Our biggest day on the field', tag: 'sports' },
    { day: '26', title: 'Constitution Day', note: 'Mock parliament: “Meet my MP”', tag: 'learning' },
    { day: '28', title: 'Primary Montessori Day', note: 'Celebrating Montessori learning', tag: 'celebration' },
  ],
  Dec: [
    { day: '02', title: 'SEEDay Magazine Release', note: 'The school magazine is out', tag: 'arts' },
    { day: '18', title: 'Arabic Day', note: 'Programmes and competitions', tag: 'arts' },
    { day: '22', title: 'Mathematics Day', note: 'Analytical reasoning and a SEED Talk', tag: 'learning' },
    { day: '23', title: 'Winter Camp', note: 'Days of discovery', tag: 'learning' },
    { day: '31', title: 'Year-End Celebration', note: 'Welcoming the new year', tag: 'celebration' },
  ],
  Jan: [
    { day: '06', title: 'Montessori Day', note: 'Short film release', tag: 'celebration' },
    { day: '09', title: 'KPSA Kids Fest', note: 'Two days of festival fun', tag: 'arts' },
    { day: '23', title: 'Achievers’ Day', note: 'Honouring our stars', tag: 'milestone' },
    { day: '24', title: 'Annual Day', note: 'The grand celebration of the year', tag: 'milestone' },
    { day: '26', title: 'Republic Day', note: 'Celebrating the Constitution of India', tag: 'celebration' },
  ],
  Feb: [
    { day: '07', title: 'Coffee with SEED', note: 'An informal meet with parents', tag: 'community' },
    { day: '21', title: 'Mother Tongue Day', note: 'Mother-tongue story writing competition', tag: 'arts' },
    { day: '28', title: 'National Science Day', note: 'Science exhibition, Digital Fest and a meeting with an ISRO scientist', tag: 'learning' },
  ],
  Mar: [
    { day: '08', title: 'Women’s Day', note: 'Celebrating the women who inspire us', tag: 'community' },
    { day: '24', title: 'Annual Examinations', note: 'The year’s final assessments', tag: 'learning' },
  ],
  Apr: [{ day: '03', title: 'Annual Parents’ Meeting & Convocation', note: 'Grade 3 convocation: our little graduates', tag: 'milestone' }],
};

export const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
export const MONTH_NAMES = {
  Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November',
  Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
};

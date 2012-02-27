ALTER TABLE Image ADD ratingsAverage REAL;
UPDATE TABLE Image SET ratingsAverage = 0;

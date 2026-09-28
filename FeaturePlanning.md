**Not for agent use.**

# Features and Admin Functionalities


## Mock Tests

**User created mock tests are simple practice sets.**

- The application level mock test will be provided publically.
- The mock test created by users for their practice will be counted as 
  simple practice set. This will be created in the database. 
  This will be helpful in analytics and performance tracking.
- Not providing the user's private mock test publically since it degrades quality.
- User will be able to share the mock test via a link to other users. 
  The creator will be the in-charge of his/her created mock test.

## Questions
- Add 'save' and 'report' button on the question card so that users can save it for later usecase
  and report the things like: 
  "invalid question", "invalid available", "invalid solution"
- I have to create a separate db table to collect the report to the question
- Admin panel should show the question which are reported with number of reports, report category etc.


## Documents
- Have to make the extraction more robust, I must not assume clean user input
- Current implementation is done assuming that user will give structured output.
- User will be able to create practice sets from documents, simple one for their practice, and share  those as well.



## Admin Functionality
I want to implement the admin functionaity into my application for managing, creating, adding
and removing mock tests, question edit, feedback page etc.




STRICT DEVELOPMENT RULES
1. if the components/system/logic/func has already registered or exist, use it don't make a doubled systems
2. do not overwrite or even change current codebase just adjust the new one with the old ones
3. you could change the entire ui so it has modern, high end startup standards like mixpanels,etc..., clear navigation, responsive on all devicess, has modern and minimalist ui like antrophic products ui
4. do not change the entire codebase change where it need to be changed
5. do not cause this error again:
1.  502  /  ERR_SSL_WRONG_VERSION_NUMBER  (req-a): The  targetUrl  in the
  database was set to  https://localhost:8080 . The  iris-core  proxy was
  attempting an SSL handshake with your local backend port, which is only serving
  plain HTTP.
  2.  401  Unauthorized (req-b): The token you used in the  curl  command (
  6b08cb41... ) failed the Argon2 verification against the hash stored in the DB.
  (The reason  req-a  passed auth earlier is because it temporarily hit the in-
  memory token cache before expiring).
  memory token cache before expiring).
6. do not effect how the integration (logics) works, your jobs are just edits the portal not the entire IRIS Logics 



menurut mu aku harus tambah apa agar IRIS-Portal memiliki fitur atau sistem yg advanced, industry grade dan senior engineer approve apa lagi yg harus ada di iris portal, dan buatakan .md file prompt nya (buatkan agar promptnya punya skill penjelasan sekelas linus tovalds), agar iris-portal tetap menggunakan sistem yg sekarang namun dengan beberapa fitur canggih yg baru seperti analytics system yg sama seperti MIXPANEL (lengkap dengan visualisasi dan halaman nya contoh /dataflow, /requestflow, /dashboard, /security (chart for abnormalitiy token usages), etc..., make it also into components so every compents can be imported) yang terintagrasi ke iris-core, lalu ada sistem yg sama seperti POWER BI (MICORSOFT) untuk sistem integrasi yg fleksibel dan pengelolahan data yg jelas, customable, canva (customables templates)/excel(table/data management)/ppt (for data displaying) bulk into ones), juga implementasikan sistem login dan signup 'signup flow (/daftar):
 1. fill form  of: first name, middle name, email, password, capctha, with tick this box i agree of the IRIS Policy and User Agreement
 2. after submit they will get into waitingfile:///C:/Users/Daffy/Downloads/readme.md list (/queue) [and always on /queue, doesn't care if he refesh it or exploit it or remove the cache and trying to login on /login and whatever they'll do they still get into /queue) and 'super admin' must acc thier request on the dashboard
 3. after admin accepted it they finally could use thfile:///C:/Users/Daffy/Downloads/agents.mde apps like normal 
login flow (/login):
 1. fill form : email, password (with password hide/see button) and captcha
 2. if users registered => get user into the app
 
ADDITIONAL INFORMATION:
 1. the app gonna have these roles (RBAC IMPLEMENTED): super admin, admin, developers (aka users)
 2. the super admin (must) have been auto created on the process 
 3. ALL UI RESOURCES ARE REGISTERED ON 'STEP3 (UI)' OR @ YOU COULD USE IT SO YOU DON'T NEED TO CREATE A COMPONENTS, IN SHORT JUST USE ALL COMPONENTS AND UI FROM 'STEP3 (UI)' INTO THE STEP3', dan smua fitur baru harus di seusaikan dengan fitur atau codebase yg sudh ada sekarang

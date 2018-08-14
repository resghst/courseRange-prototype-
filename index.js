const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const cheerio = require('cheerio')
const Enities = require('html-entities').XmlEntities
const enities = new Enities()
const _ = require('lodash')
const request = require('request')
const j = request.jar()
const rp = require('request-promise')

const readline = require('readline');

const http = require('http')
const Router = require('router')
const bodyParser = require('body-parser')

let schoolId = ''//postData.id
let schoolPw = ''//postData.pw
try {
  getCredit(schoolId, schoolPw)
}
catch(e) {console.log(e)}

function getCredit (schoolId, schoolPw) {
  const nchuam = 'https://nchu-am.nchu.edu.tw/nidp/'
  const portal = 'https://portal.nchu.edu.tw/portal/'
  const onepiece = 'https://onepiece2.nchu.edu.tw/cofsys/plsql/'
  const rpcookie = rp.defaults({
    transform: cheerio.load,
    jar: j,
    simple: false,
    followRedirect: true
  })
  let courseList = {
    'studentName': '',
    'studentID': '',
    'studentDept': '',
    'courseList': []
  }
  // courseList.studentName
  courseList.studentID = schoolId
  
  return rpcookie(nchuam + 'idff/sso?sid=0&sid=0')
    .then($ => {
      return rpcookie.post(nchuam + 'idff/sso?sid=0&sid=0', {form: {
        'Ecom_User_ID': schoolId,
        'Ecom_Password': schoolPw,
        'option': 'credential',
        'target': 'https://portal.nchu.edu.tw/portal'
      }})
    })
    .then($ => { return rpcookie(nchuam + 'app?sid=0') })
    .then($ => {
      return rpcookie.post(portal + 'j_spring_security_check', {form: {
        'j_username': schoolId,
        'j_password': schoolPw
      }})
    })
    .then($ => { return rpcookie(portal) })
    .then($ => { return rpcookie.post(portal) })
    .then($ => { return rpcookie(onepiece + 'acad_home') })
    .then($ => {
      return rpcookie.post(onepiece + 'ACAD_PASSCHK', {form: {
        v_emp: schoolId,
        v_pwd: schoolPw,
        v_lang: 'chn'
      }})
    })
    .then($ => { return rpcookie(onepiece + 'stud_score_qry') })
    .then($ => {
      let year = [], yearselect = $('select option')
      for( i = 0 ; i < yearselect.length ; i++ ) year[i]=yearselect[i].children[0].data.split("\n")[0]
      console.log(year)

      let len = 0
      let lolo = -1
      console.log('year.length\t'+year.length)
      for(let k = 0, py = Promise.resolve(); k < year.length; k++){
        py = py.then( ( _) => new Promise( resolve => {
          rpcookie.post(onepiece + 'stud_score_qry', { form: {'v_year': year[++lolo]} })
          .then( $ =>{
            let urllist = [], j = 0
            let cselector = $('table[border="1"] tr td')
            for(i=0;i<cselector.length-5*10;i+=10)
              try{
                let cobj = {
                  'cNO': '',
                  'cName': { 'ch': '', 'en': '' },
                  'cClass': '',
                  'cOffered_Dept': { 'ch': '', 'en': '' },
                  'cRequired': '',
                  'cCredits': null,
                  'cTempScore': null,
                  'cFinalScore': null,
                  'cGrade': null,
                  'cRangeLink': '',
                  'cRange': [],
                }
                cobj.cNO = cselector[i+0].children[0].data                           //選課號碼Course No
                cobj.cName.ch = cselector[i+1].children[0].children[0].data          //課程名稱
                cobj.cName.en = cselector[i+1].children[2].children[0].data          //Course Name
                cobj.cClass = cselector[i+2].children[0].data                        //課程分類 Classification
                cobj.cOffered_Dept.ch = cselector[i+3].children[0].data              //開課系所
                cobj.cOffered_Dept.en = cselector[i+3].children[2].children[0].data  //Offered Dept
                cobj.cRequired = cselector[i+4].children[0].data                     //必選修 Required
                cobj.cCredits = cselector[i+5].children[0].data                      //學分 Credits
                cobj.cTempScore = cselector[i+6].children[0].data                    //公告成績Temporary Score
                cobj.cFinalScore = cselector[i+7].children[0].data                   //成績Score
                cobj.cGrade = cselector[i+8].children[0].data                        //等第Grade
                cobj.cRangeLink = cselector[i+9].children[0].attribs.href            //成績級距連結Class Score Range link
                urllist[j++] = cselector[i+9].children[0].attribs.href               //成績級距連結Class Score Range link
                courseList.courseList.push(cobj)
              }
              catch(e){ console.log(e) }
            console.log('\n\n')
            console.log(year[lolo])
            console.log(lolo)
            console.log(urllist)

            for(let i = 0, pc = Promise.resolve(); i < urllist.length; i++)
              pc = pc.then( _ => new Promise( resolve => {
                rpcookie(onepiece + urllist[i])
                .then( $ => {
                  let cRange = [], selector = $('table tr td')
                  for(j = 11; j < selector.length; j++) cRange.push(selector[j].children[0].data)
                  courseList.courseList[len++].cRange = cRange
                  if(i == urllist.length-1) return printdata(courseList) // [ i , courseList ]
                  resolve();
                })
              }))
            resolve();
          })
        }))
      }
  })
}

function printdata(data){
  let output = []
  try{ 
    for(let jl = 0; jl<data.courseList.length; jl++){
      let pushobj = [data.courseList[jl].cName.ch, data.courseList[jl].cRange]
      output.push(pushobj)
    }
    console.log("*********************")
    console.log(output)
    fs.writeFile('output.json', JSON.stringify(output) )
  }
  catch(e){console.log(e)}
}
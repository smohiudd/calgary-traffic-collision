import React from 'react';
import ReactDOM from 'react-dom';
import './styles.css';
import class_list from './geohash.json';
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import Geohash from 'latlon-geohash'
import * as turf from '@turf/turf'
import * as tf from '@tensorflow/tfjs';
import gradient from './gradient.png';


const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const hours =['0am','1am','2am','3am','4am','5am','6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm']
const months =['January','February','March','April','May','June','July','August','September','October','November','December']

let features = []
let geojson;
let model;

const predict = async () => {
  model = await tf.loadModel('https://s3-us-west-2.amazonaws.com/calgary-collision-model/model.json')
}

mapboxgl.accessToken = 'pk.eyJ1Ijoic2FhZGlxbSIsImEiOiJjamJpMXcxa3AyMG9zMzNyNmdxNDlneGRvIn0.wjlI8r1S_-xxtq2d-W5qPA';

class Application extends React.Component {


  constructor(props: Props) {
    super(props);
    this.handle = this.handle.bind(this)
    this.state = {
      lng: -114.073538,
      lat: 51.045012,
      zoom: 10.2,
      weekday:'Monday',
      month: 'June',
      hour:'5pm'
    };
  }

  componentDidMount() {

    const { lng, lat, zoom } = this.state;

    this.map = new mapboxgl.Map({
      container: this.mapContainer,
      style: 'mapbox://styles/saadiqm/cjfnjiowo0zj62rpj0y1qpib0',
      center: [lng, lat],
      zoom
    });

    this.map.on('load', () => {

      this.map.addSource('Collisions', {
        type: 'geojson',
        data: {
           "type": "FeatureCollection",
           "features": []
        }
      });

      this.map.addLayer({
          "id": "Collisions",
          "type": "fill",
          "source": 'Collisions',
          "paint": {
            'fill-color': '#f442e5',
            'fill-opacity': {
              property:"prob",
              stops: [
                [0.5,0.01],
                [0.6,0.05],
                [0.7,0.1],
                [0.8,0.2],
                [0.9,0.7],
                [1,0.9]
              ]
            }
          }
      });

      class_list.map((item)=> {

        let d = Geohash.bounds(item)
        let sw = turf.point([d.sw.lon,d.sw.lat])
        let ne = turf.point([d.ne.lon,d.ne.lat])
        let collection = turf.featureCollection([sw,ne])
        let enveloped = turf.envelope(collection);
        enveloped.properties['prob']=Math.random()
        features.push(enveloped)
        return features

      });

      geojson = turf.featureCollection(features)

    })

    predict()

  }

  componentDidUpdate(){

    let geohash_indices =[]

    class_list.map((i,index) => geohash_indices.push(index))

    let geohash_one_hot = tf.oneHot(tf.tensor1d(geohash_indices, 'int32'), geohash_indices.length)

    let input_day = days.indexOf(this.state.weekday)
    let input_hour = hours.indexOf(this.state.hour)
    let input_month = months.indexOf(this.state.month)

    var convert_cyclical = function(number, max) {
      let sin = Math.sin(2 * Math.PI * number/max)
      let cos = Math.cos(2 * Math.PI * number/max)

      return tf.tensor1d([sin, cos]).reshape([1,2])
     };

    let tensor_month = convert_cyclical(input_month,12);
    let tensor_day = convert_cyclical(input_day,6);
    let tensor_hour = convert_cyclical(input_hour,23);

    let time_tile = tf.concat([tensor_month,tensor_day,tensor_hour],1).reshape([-1]).tile([geohash_indices.length]).reshape([geohash_indices.length, 6])

    let input = time_tile.concat(geohash_one_hot, 1)

    let output = model.predict(input).dataSync()

    geojson.features.map((i,index) => i.properties.prob=output[index])

    this.map.getSource('Collisions').setData(geojson);

  }

  handle(e){
    e.preventDefault();

    let id = String(e.target.id)
    let selection = e.target.value

    if(id==='weekday'){
      this.setState({weekday:selection});

    }else if(id ==='months'){
      this.setState({month:selection})

    }else if(id ==='hours'){
      this.setState({hour:selection})
    }

  }

  render() {

    let optionWeekdays = days.map((day) => <option key={day} value={day}>{day}</option>);
    let optionMonths = months.map((day) => <option key={day} value={day}>{day}</option>);
    let optionHours = hours.map((day) => <option key={day} value={day}>{day}</option>);

    return (
      <div>
      <div ref={el => this.mapContainer = el} className="absolute top right left bottom" />
        <div className="border_box">
          <h1>Calgary Traffic Incident Prediction</h1>

          <div className="description">
            <h2>Predict traffic incident <strong>probability</strong> with machine learning and open data</h2>
          </div>

          <div className='row'>

            <div className="column">
              <select id={'weekday'} onChange={this.handle} value={this.state.value} defaultValue={this.state.weekday} className="select_option">
                  {optionWeekdays}
              </select>
            </div>

            <div className="column">
              <select id={'months'} onChange={this.handle} value={this.state.value} defaultValue={this.state.month} className="select_option">
                  {optionMonths}
              </select>
            </div>

            <div className="column">
              <select id={'hours'} onChange={this.handle} value={this.state.value} defaultValue={this.state.hour} className="select_option">
                  {optionHours}
              </select>
            </div>
          </div>

          <img src={gradient} alt="gradient" style={{marginTop:"5px"}} />
          <div id="textbox">
              <p className="alignleft">Low Probability</p>
              <p className="alignright">High Probability</p>
          </div>
          <div style={{clear: "both"}}></div>

          <div className='byline'>
            <h4>&copy;2018 Saadiq Mohiuddin <a href="https://nodalscapes.wordpress.com/">www.nodalscapes.com</a></h4>
          </div>

        </div>

      </div>
    );
  }
}

ReactDOM.render(<Application />, document.getElementById('root'));

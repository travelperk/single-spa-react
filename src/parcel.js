/* This import statement requires a peer or dev dependency on react that is fulfilled at runtime.
 * To avoid duplicate bundling of react, we do not do this inside of single-spa-react.js.
 * We also do not set up the prop types in this file to avoid requiring the user of the library
 * to have prop-types installed and in their browser bundle, since not everyone uses prop types.
 */
import React from 'react'
import {SingleSpaContext} from '../lib/single-spa-react.js'

export default class Parcel extends React.Component {
  static defaultProps = {
    wrapWith: 'div'
  }
  constructor(props) {
    super(props)

    this.state = {
      hasError: false,
    }

    if (!props.config) {
      throw new Error(`single-spa-react's Parcel component requires the 'config' prop to either be a parcel config or a loading function that returns a promise. See https://github.com/CanopyTax/single-spa-react`)
    }
  }
  componentDidMount() {
    this.addThingToDo('mount', () => {
      const mountParcel = this.props.mountParcel || this.mountParcel
      if (!mountParcel) {
        throw new Error(`<Parcel /> was not passed a mountParcel prop, nor is it rendered where mountParcel is within the React context`)
      }
      let domElement;
      if (this.el) {
        domElement = this.el
      } else {
        this.createdDomElement = domElement = document.createElement(this.props.wrapWith)
        this.props.appendTo.appendChild(domElement)
      }
      this.parcel = mountParcel(this.props.config, {domElement, ...this.getCustomProps()})
      return this.parcel.mountPromise
    })
  }
  componentDidUpdate() {
    this.addThingToDo('update', () => {
      if (this.parcel && this.parcel.update) {
        this.parcel.update(this.getCustomProps())
      }
    })
  }
  componentWillUnmount() {
    this.addThingToDo('unmount', () => {
      if (this.parcel && this.parcel.getStatus() === "MOUNTED") {
        return this.parcel.unmount()
      }
    })

    if (this.createdDomElement) {
      this.createdDomElement.parentNode.removeChild(this.createdDomElement)
    }

    this.unmounted = true
  }
  render() {
    if (this.props.appendTo) {
      if (SingleSpaContext && SingleSpaContext.Consumer) {
        return (
          <SingleSpaContext.Consumer>
            {({mountParcel}) => {
              this.mountParcel = mountParcel

              return null
            }}
          </SingleSpaContext.Consumer>
        )
      } else {
        return null
      }
    } else {
      const reactElement = React.createElement(this.props.wrapWith, {ref: this.handleRef})

      if (SingleSpaContext && SingleSpaContext.Consumer) {
        return (
          <SingleSpaContext.Consumer>
            {({mountParcel}) => {
              this.mountParcel = mountParcel

              return reactElement
            }}
          </SingleSpaContext.Consumer>
        )
      } else {
        // react@<16.3, or not being rendered within a single-spa application
        return reactElement
      }
    }
  }
  handleRef = el => {
    this.el = el
  }
  addThingToDo = (action, thing) => {
    if (this.state.hasError && action !== 'unmount') {
      // In an error state, we don't do anything anymore except for unmounting
      return
    }

    this.nextThingToDo = (this.nextThingToDo || Promise.resolve())
      .then((...args) => {
        if (this.unmounted && action !== 'unmount') {
          // Never do anything once the react component unmounts
          return
        }

        return thing(...args)
      })
      .catch(err => {
        this.nextThingToDo = Promise.resolve() // reset so we don't .then() the bad promise again
        this.setState({hasError: true})

        if (err && err.message) {
          err.message = `During '${action}', parcel threw an error: ${err.message}`
        }

        if (this.props.handleError) {
          this.props.handleError(err)
        } else {
          setTimeout(() => {throw err})
        }

        // No more things to do should be done -- the parcel is in an error state
        throw err
      })
  }
  getCustomProps = () => {
    const customProps = Object.assign({}, this.props)

    delete customProps.mountParcel
    delete customProps.config
    delete customProps.wrapWith
    delete customProps.appendTo
    delete customProps.handleError

    return customProps
  }
}
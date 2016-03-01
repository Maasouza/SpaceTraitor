
//Carregando a dependencia three-world
var Mundo = require('three-world')
//carregando modulo three
var THREE = require('three')
// carregando o modulo de load de objetos 3D
var myLoader = require('./objmtlloader')
var myLoaderOBJ = require('./objloader')

var time = 0.0
var gameoverMode =false

//funçoes e variaves
var somTiro = new Audio("audio/tiro.mp3")
var somTiro2 = new Audio("audio/tiro.mp3")//caso o deltaT entre os tiros seja pequeno
somTiro.volume = 0.35
somTiro2.volume = 0.35

//meteoro batendo na nave
var somMeteoro = new Audio("audio/explosao.mp3")
somMeteoro.volume = 0.35

//capturando uma nave
var captura = new Audio("audio/item.mp3")
captura.volume = 0.35

//destruindo uma nave ou meteoro
var destruir = new Audio("audio/asteroide.mp3")
var destruir2 = new Audio("audio/asteroide.mp3")//mesmo motivo do somTiro2
destruir2.volume =0.35
destruir.volume = 0.35

//audio menu gameover
var gameover = new Audio("audio/gameover.mp3")
gameover.volume = 0.35
gameover.loop = true

//audio 0 vidas
var nolife = new Audio("audio/navelife.mp3")
nolife.volume = 0.35

//flag audio musica
var on = true
var miraOn = true

//Numero de asteroides e inimigos
var N_OBJS = 11

//diametro do mapa
var diametro = 100

// material asteroide
var astMaterial = new THREE.MeshLambertMaterial({
  map: THREE.ImageUtils.loadTexture('images/lua.png')
})

//material mira
//mira branca
var mtMira = new THREE.LineBasicMaterial({
  color:0xFFFFFF,
  transparent:true,
  opacity:0.4
})

//mira vermelha(quando atravessa algum asteroide)
var mtMiraV = new THREE.LineBasicMaterial({
  color:0xFF1100,
  transparent:true,
  opacity:0.4
})

//geometria mira
var geoMira = new THREE.Geometry()
geoMira.vertices.push(
  new THREE.Vector3( 0, -25, 0 ),
	new THREE.Vector3( 0, -25,-1000 )
)

//direçao do raio do raycast
var direcao = new THREE.Vector3(0,0,-1)


//gerenciador de carregamento
var manager = new THREE.LoadingManager();
manager.onProgress = function ( item, loaded, total ) {
		console.log( item, loaded,total);
    var porcento = (loaded/total)*100
    //atualiza a % da tela de carregamento
    document.getElementById("loading").innerHTML = "Carregando "+item+" ... "+Math.round(porcento, 2)+"%";
};
//quando todos os modelos tiverem carregados
manager.onLoad = function(){
  //retirar a tela de carregamento e iniciar o jogo
  document.getElementById("backgroundAudio").play();
  document.getElementById("loadDiv").style.display='none';
  document.getElementById("infobar").style.display='block';

  Mundo.start()
}

//funçao de carregamento de cada loader
var onProgress = function ( xhr ) {
  if ( xhr.lengthComputable ) {
    var percentComplete = xhr.loaded / xhr.total * 100;
		console.log( Math.round(percentComplete, 2) + '% downloaded' );
	}
};
//---------------------------------Mapa---------------------------------------
var Mapa = function(texPath) {
  //criando pois somente é retornado um objeto
  var mapa = new THREE.Object3D()
  var formas = [];
  var hitbox;
  this.hitbox = new THREE.Box3();
  //criando um malha
  formas.push(new THREE.Mesh(
    new THREE.CylinderGeometry(diametro, diametro, 5000, 24, 24, true),//forma cilindrica
    new THREE.MeshBasicMaterial({//carregando a textura
      map: THREE.ImageUtils.loadTexture(texPath, null, function(textura) {
        textura.wrapS = textura.wrapT = THREE.RepeatWrapping
        textura.repeat.set(5, 10)
        textura.needsUpdate = true
      }),
      side: THREE.BackSide //textura aplicada internamente
    })
  ))
  //rotacionando o cilindro para pos frontal a camera
  formas[0].rotation.x = -Math.PI/2
  formas.push(formas[0].clone())
  formas[1].position.z=-5000

  mapa.add(formas[0])
  mapa.add(formas[1])

  this.getMapa = function() {
    //retorna o objeto
    return mapa
  }

  //reposicionando um cilindro
  this.atualizarZ = function(z) {
      for(var i=0; i<2; i++) {
        if(z < formas[i].position.z - 2500) {
          formas[i].position.z -= 10000
          break
        }
      }
      this.hitbox.setFromObject(mapa)
    }

  return this;
}

//---------------------------------Nave----------------------------------------

var nave = null
var Nave = function(sObject){
  //
  var pontos,vida
  //funcionar dentro das outras funçoes
  var self=this
  //criando o hitbox
  self.hitbox = new THREE.Box3()
  nave = null
  this.vida = 3
  this.pontos = 0
  var loaded = false
  //instanciando o loader
  var objmtlLoad = new THREE.OBJMTLLoader(manager);
  //definir modelo como nao carregado
  this.loaded = false
  //caso nao tenha uma nave
  if(nave === null){
      //carregando o modelo da nave
      objmtlLoad.load(
        //local do objeto
        'obj/thenave.obj',
        //local material
        'obj/thenave.mtl',
        //quando carrega-los
        function(object){
          //nave 2.5% do tamanho original
          object.scale.set(0.025,0.025,0.025)
          object.rotation.set(0, Math.PI, 0)
          nave = object
          nave.position.set(0, -25, -80)
          //ancorando a nave à um objeto
          sObject.add(nave)
          //criar posiçao posição do hitbox
          self.hitbox.setFromObject(object)//copia a posição e as dimensoes do objeto
          //definir nave como carregada
          self.loaded = true
        },
        onProgress
      )
    }else{
      sObject.add(nave)
      self.loaded = true
    }
    //funçao para atualizar a posição do hitbox
    this.atualizar = function(){
        if(nave!=null){
          this.hitbox.setFromObject(nave)//copia a posição e as dimensoes do objeto
        }
    }

}

//---------------------------------Asteroide-----------------------------------

var Asteroide = function() {
  var loaded = false
  var asteroide = new THREE.Object3D()
  var objmtlLoad = new THREE.OBJLoader(manager);
  var self=this;
  var pontosDados //pontos recebidos por destruir entre [10,20]
  this.hitbox = new THREE.Box3()
  this.pontosDados = Math.floor(10 + Math.random()*10)
  //velocidade de translação
  asteroide.velocity = Math.random()*3.5 + 2.0
  //velocidade de rotação
  asteroide.vRotation = new THREE.Vector3(Math.random(), Math.random(), Math.random())

  objmtlLoad.load(
    //modelo
    "obj/asteroide.obj",
    //quando carregar-los
    function(object){

			object.traverse( function ( child ) {
			   if(child instanceof THREE.Mesh ) {
			      child.material = astMaterial;
			   }
			  }
      )
      object.scale.set(6,6,6)
      asteroide.add(object)
      //randomizando a posiçao do asteroide dentro do cilindro
      asteroide.position.set(-(diametro/2) + Math.random() * 100, -(diametro/2) + Math.random() * diametro, -1500 - Math.random() * 1500)
      self.loaded = true

    },
    onProgress
  )
  // funçao para reposicionar o objeto
  this.resetar = function(z){
    // redefine a velocidade
    asteroide.velocity = Math.random()*3.5 + 2
    //repo
    asteroide.position.set(
      -(diametro/2) + Math.random() * diametro,
      -(diametro/2) + Math.random() * diametro,
      z - 1500 - Math.random() * 1500
    )
    this.pontosDados =Math.floor( 10 + Math.random()*10 )

  }

  this.atualizar = function(z) {
    //a cada frame atualizar a posição e a rotação
    asteroide.position.z += asteroide.velocity
    asteroide.rotation.x += asteroide.vRotation.x * 0.05;
    asteroide.rotation.y += asteroide.vRotation.y * 0.05;
    asteroide.rotation.z += asteroide.vRotation.z * 0.05;
    //se existir um
    if(asteroide.children.length > 0) this.hitbox.setFromObject(asteroide.children[0])

    //se o asteroide passar da nave reiniciar a posição
    if(asteroide.position.z > z) {
      this.resetar(z)
    }
  }

  this.getAsteroide = function() {
    //retorna o objeto criado
    return asteroide
  }
  return this
}

//-------------------------------inimigos-------------------------------

var Inimigo = function() {
  var carregado = false
  var inimigo = new THREE.Object3D()
  var objmtlLoad = new THREE.OBJMTLLoader(manager);
  var self=this
  this.loaded = false
  //velocidade de translação
  inimigo.velocity = 5
  //
  this.hitbox = new THREE.Box3()

  objmtlLoad.load(
    //modelo
    "obj/tielow.obj",
    //materialName
    "obj/tielow.mtl",
    //quando carregar-los
    function(object){
      object.scale.set(0.15,0.15,0.15)
      object.rotation.set( Math.PI, Math.PI, 0)
      inimigo.add(object)
      inimigo.position.set(-(diametro/2) + Math.random() * diametro,-(diametro/2)
        + Math.random() * diametro, -1500 - Math.random() * 1500)
      self.loaded = true

    },
    onProgress
  )

  this.resetar = function(z){
    inimigo.position.set(
      -(diametro/2) + Math.random() * diametro,
      -(diametro/2) + Math.random() * diametro,
      z - 1500 - Math.random() * 1500
    )
  }

  this.atualizar = function(z) {
    //a cada frame atualizar a posição
    inimigo.position.z += inimigo.velocity
    if(inimigo.children.length > 0) this.hitbox.setFromObject(inimigo.children[0])

    //se o inimigo passar da nave reiniciar a posição
    if(inimigo.position.z > z) {
      this.resetar(z)
    }
  }

  this.getInimigo = function() {
    //retorna o objeto criado
    return inimigo
  }

  return this
}

//--------------------------Tiro-----------------------------------------

var municao = new  THREE.MeshPhongMaterial({  //material do tiro
  color: 0xf2ea63,
  emissive: 0xebeb6c //cor emitada pelo objeto
})

var Tiro = function(p){ //classe tiro, inicializada na posiÃ§Ã£o P0
  var objTiro = null

  this.objTiro  = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35,0.35,1.5), //geometria do tiro
    municao//material
  )

  this.hitbox = new THREE.Box3()

  //copiando a posição da nave
  this.objTiro.position.copy(p)

  this.getTiro = function(){
    return this.objTiro
  }

  this.atualizar = function(z){
    //velocidade do tiro
    this.objTiro.position.z -=10
    //atualizando a hitbox com a posicao e formato do objeto(caso mude)
    this.hitbox.setFromObject(this.objTiro)
    //se o tiro passar de uma -1000 retirar ele da cena
    if(Math.abs(this.objTiro.position.z - z) > 1000){
      return false
      delete this.objTiro
    }
    return true
  }
  return this
}

//-----------------------------------explosao------------------------------
//////////////settings////////////
var velProj = 20;//velocidade da explosao
var totalObjects = 500;//numero de particulas
var colors = [0xCCCCCC, 0xDDDDDD, 0xFFFFFF, 0xEEEEEE, 0xF3F3F3]; //possiveis cores
/////////////////////////////////
var dirs = [];//vetor de direçoes
var explosoes = [];//vetor das explosoes

function ExpParticulas(x,y,z,objectSize){//funçao que cria 500 cubos na posição x,y,z com tamanho objectSize
  var geometry = new THREE.Geometry();

  //criando cada cubo
  for (i = 0; i < totalObjects; i ++)
  {
    var vertex = new THREE.Vector3();
    vertex.x = x;
    vertex.y = y;
    vertex.z = z;

    geometry.vertices.push( vertex );
    dirs.push({x:(Math.random() * velProj)-(velProj/2),y:(Math.random() * velProj)-(velProj/2),z:(Math.random() * velProj)-(velProj/2)});
  }
  //criando o material , setando o tamanho do cubo e a cor
  var material = new THREE.ParticleBasicMaterial( { size: objectSize,  color: colors[Math.round(Math.random() * colors.length)] });
  var particles = new THREE.ParticleSystem( geometry, material );

  this.object = particles;
  this.status = true;

  this.nTimes = 0;
  Mundo.add(this.object)
  this.update = function(){//funçao que atualiza a posicao das particulas
    if (this.status == true){
      var nObjexp = totalObjects;
      while(nObjexp--) {
        var particle =  this.object.geometry.vertices[nObjexp]
        particle.y += dirs[nObjexp].y;
        particle.x += dirs[nObjexp].x;
        particle.z += dirs[nObjexp].z;
      }
      this.nTimes++
      this.object.geometry.verticesNeedUpdate = true;
      if (this.nTimes==100){//se o numero de interaçoes for maior que 100 remover as particulas da tela
        this.status = false;
        Mundo.remove(this.object)
      }
    }
  }
}
//-------------------------------------------------------------------------


var teclado = new THREEx.KeyboardState();
var clock = new THREE.Clock();
//angulo da nave no eixo z
var ang = 0;
//
var canGo = [true,true,true,true] // direçao que a nave pode andar [left,right,up,down]
var updatePos = function(){

  //tempo entre uma chamada e outra
  var delta = clock.getDelta()
  //valor de quanto a nave vai andar
  var distancia = 60*delta;
  // valor de quanto a nave vai girar
  var angulo = Math.PI/5*delta;

  //se o objeto estiver dentro do cubo que envolve o cilindro  tornar todas as direçoes possiveis
  if(mapa.hitbox.containsBox(jogador.hitbox)){
    for(var i = 0;i<canGo.length;i++){
      canGo[i]=true
    }
  }

  //verificando as teclas
  if(teclado.pressed("left") && canGo[0]){

    view.position.x-=distancia;
    //se ele nao podia ir pra direita, agora pode
    if(!canGo[1]){
      canGo[1]=true
    }

    //se o mapa nao coontem o jogador ele nao pode ir mais para esquerda
    if(!mapa.hitbox.containsBox(jogador.hitbox)){
      view.position.x+=distancia ;
      canGo[0]=false
    }
    if(ang>-Math.PI/8){
    view.children[0].rotation.z-=angulo
    ang-=angulo
  }
  }
  if(teclado.pressed("right") && canGo[1]){

    view.position.x+=distancia;
    if(!canGo[0]){
      canGo[0]=true
    }
    //se o mapa nao coontem o jogador ele nao pode ir mais para direita
    if(!mapa.hitbox.containsBox(jogador.hitbox)){
      view.position.x-=distancia ;
      canGo[1]=false
    }

    if(ang<Math.PI/8){
    view.children[0].rotation.z+=angulo
    ang+=angulo
    }
  }
  //retornando a nave para horizontal caso nao esteja se movendo
  if(!teclado.pressed("right") && !teclado.pressed("left")){
    if(ang>Math.PI/180){
      view.children[0].rotation.z-=angulo
      ang-=angulo
      if(!mapa.hitbox.containsBox(jogador.hitbox)){
        view.position.x-=distancia
      }
    }else{//corrigir bug de tremer o objeto por variar entre pequenos angulos
      if(ang<-Math.PI/180){
        view.children[0].rotation.z+=angulo
        ang+=angulo
        if(!mapa.hitbox.containsBox(jogador.hitbox)){
          view.position.x+=distancia
        }
      }else{
        view.children[0].rotation.z=0
        ang=0
      }
    }
  }
  if(teclado.pressed("up") && canGo[2]){
    view.position.y+=distancia;
    if(!canGo[3]){
      canGo[3]=true
    }
    //se o mapa nao coontem o jogador ele nao pode ir mais para cima
    if(!mapa.hitbox.containsBox(jogador.hitbox)){
      view.position.y-=distancia ;
      canGo[2]=false
    }


  }else{
    if(teclado.pressed("down") && canGo[3]){
    view.position.y-=distancia;
    if(!canGo[2]){
      canGo[2]=true
    }
    //se o mapa nao coontem o jogador ele nao pode ir mais para baixo
    if(!mapa.hitbox.containsBox(jogador.hitbox)){
      view.position.y+=distancia ;
      canGo[3]=false
    }


  }}
  //corrigir o bug da nave nao se movimentar
  if(!mapa.hitbox.containsBox(jogador.hitbox)){
    if(view.position.x>0){
      view.position.x-=distancia;
    }else{
      view.position.x+=distancia
    }
    if(view.position.y>0){
      view.position.y-=distancia;
    }else{
      view.position.y+=distancia
    }
  }
}

//função de update de frame
function render() {
  //atualizar a posição da nave(camera)
  view.position.z-=2;

  //mover um dos cilindro que formam o mapa caso necessario
  mapa.atualizarZ(view.position.z)

  //atualizar a posiçao do hitbox da nave
  jogador.atualizar()

  for(var i=0; i<tiros.length; i++){ //removendo os tiros depois de uma certa posição
    if(!tiros[i].atualizar(view.position.z)){
      Mundo.getScene().remove(tiros[i].getTiro())
      tiros.splice(i, 1)
    }
  }

  //atualizar a posição dos asteroides, verificar colisao com a nave ou com a mira
  var rOrigem = mira.geometry.vertices[0] //origem do raio é a mesma origem da mira
  var ray = new THREE.Ray(rOrigem,direcao)//raycast

  var countI=0//variavel de controle de objetos intersectados

  for(var i=0;i<N_OBJS;i++) {
    if(!asteroides[i].loaded)continue
    //verificar se o asteroide foi intersectado
    var interBox = ray.intersectBox(asteroides[i].hitbox)
    if(interBox != null){
      countI+=1
    }
    //atualiza a posiçao do asteroides
    asteroides[i].atualizar(view.position.z)
    //verifica se a nave colide com o asteroide
    if(jogador.loaded && jogador.hitbox.isIntersectionBox(asteroides[i].hitbox)){
      asteroides[i].resetar(view.position.z)
      if(jogador.vida>1) {
        somMeteoro.play()
      }else{
        nolife.play()
      }

      //alterar a infobar
      switch (jogador.vida) {
        case 3:{
                document.getElementById('vida').textContent = "♥ ♥"
                break;
               }
        case 2:{
                document.getElementById('vida').textContent = "♥"
                break;
               }
        default:break;

      }

      //retirar uma vida do jogador
      jogador.vida-=1

    }
    //verifica se o jogador acertou um tiro no asteroide
    for(var j=0; j<tiros.length; j++) {
        if(asteroides[i].hitbox.isIntersectionBox(tiros[j].hitbox)) {
          if(destruir.paused){
            destruir.play()
          }else{
            destruir2.play()
          }
          explosoes.push(new ExpParticulas(asteroides[i].getAsteroide().position.x,asteroides[i].getAsteroide().position.y,asteroides[i].getAsteroide().position.z,5))
          //adiciona a pontuação equivalente ao asteroide
          jogador.pontos+=asteroides[i].pontosDados
          document.getElementById('pontos').textContent = jogador.pontos //atualiza a infobar
          asteroides[i].resetar(view.position.z)
          Mundo.getScene().remove(tiros[j].getTiro())//remove o tiro
          tiros.splice(j, 1)
          break
        }
      }
  }

  naveI.atualizar(view.position.z)
  //captura da nave inimiga pelo jogador
  if(jogador.loaded && jogador.hitbox.isIntersectionBox(naveI.hitbox)){
    captura.play()
    naveI.resetar(view.position.z)
    jogador.pontos+=25
    document.getElementById('pontos').textContent = jogador.pontos
  }

  //verificar se o inimigo foi abatido
  for(var j=0; j<tiros.length; j++) {
      if(naveI.hitbox.isIntersectionBox(tiros[j].hitbox)) {
        if(destruir.paused){
          destruir.play()
        }else{
          destruir2.play()
        }
        explosoes.push(new ExpParticulas(naveI.getInimigo().position.x,naveI.getInimigo().position.y,naveI.getInimigo().position.z,5))
        naveI.resetar(view.position.z)
        Mundo.getScene().remove(tiros[j].getTiro())
        tiros.splice(j, 1)
        if(jogador.pontos>=10){
          jogador.pontos-=10
          document.getElementById('pontos').textContent = jogador.pontos
        }
        break
      }
  }

  for(var i = 0; i<explosoes.length; i++){
    if(explosoes[i].status){
      explosoes[i].update()
    }else{
      explosoes.splice(i,1)
    }

  }

  //se o raio itersectou algum asteroide mudar a mira de cor
  if (countI>0){
      mira.material = mtMiraV;//vermelha
  }else {
      mira.material = mtMira;//branca
  }

  //atualizando os vertices da mira
  mira.geometry.vertices[0] = view.position.clone().add(new THREE.Vector3(0,-25,-80))
  mira.geometry.vertices[1] = view.position.clone().add(new THREE.Vector3(0,-25,-9999999))
  mira.geometry.verticesNeedUpdate = true;
  mira.geometry.colorsNeedUpdate = true

  //se o jogador perder todas as vidas entrar em modo gameover
  if(jogador.vida==0){
    jogador.vida=-1
    Mundo.remove(view)
    Mundo.remove(mira)
    explosoes.push(new ExpParticulas(view.position.x,view.position.y-25,view.position.z-80,10))
    gameoverMode = true
  }

  if(gameoverMode){
    time += clock.getDelta()
    console.log(time)
    if( time>0.5){
      gameoverState()
    }
   }


  //função de atualiza posição baseado nos inputs do teclado
  updatePos()
}

//funçao para entrar no modo gameover
var gameoverState = function(){
  for(var i = 0; i<explosoes.length; i++){
    if(explosoes[i].status){
      explosoes[i].status=false
      explosoes[i].update()
    }
  }
  explosoes=[]
  //pausar o mundo e a musica de fundo
  Mundo.pause();
  document.getElementById("backgroundAudio").pause()
  gameover.play()
  somTiro.volume=0.0
  somTiro2.volume=0.0
  //mudar de layout e exibir a pontuação feita
  document.getElementById("infobar").style.display='none';
  document.getElementById("pontuacao").innerHTML = "Pontos : "+jogador.pontos;
  document.getElementById("backgroundMenu").style.display="block";
}

//funçao chamada no novo jogo
window.resetarMundo = function(){
    gameoverMode=false
    time = 0
    Mundo.add(view)
    Mundo.add(mira)
  //resetar a inclinaçao da nave
  ang=0
  //resetando a posição do asteroides,nave e removendo os tiros
  for(var i = 0;i<asteroides.length;i++){
      asteroides[i].resetar(view.position.z)
  }

  //resetar os tiros
  naveI.resetar(view.position.z)

  for(var i=0; i<tiros.length; i++){ //removendo os tiros
        Mundo.remove(tiros[i].getTiro())
      tiros.splice(i, 1)
  }

  //pausar a musica de gameover
  gameover.pause();

  somTiro.volume=0.35
  somTiro2.volume=0.35

  //mudar de layout
  document.getElementById("infobar").style.display='block';
  document.getElementById("backgroundMenu").style.display="none";

  //resetar dados da infobar
  document.getElementById('vida').textContent = "♥ ♥ ♥"
  document.getElementById('pontos').textContent = 0

  //resetando a vida e os pontos do jogador
  jogador.vida=3
  jogador.pontos=0

  //resetar a posiçao da camera
  view.position.x=0
  view.position.y=0

  //retomar a musica de fundo do jogo
  document.getElementById("backgroundAudio").play()

  //retormar a execuçao do jogo
  Mundo.resume()
}

//Iniciando o mundo
Mundo.init({ renderCallback: render,clearColor: 0x0000022,antialias:true}) //definindo a funçao de update e a cor de fundo do mundo

//adcinando uma linha que vai servir de mira
var mira = new THREE.Line(geoMira,mtMira)
Mundo.add(mira)

//criando um mapa passando  textura como parametro
var mapa = new Mapa('images/1.jpg')

//definindo uma camera
var view  = Mundo.getCamera()

//criando nova nave
var jogador = new Nave(view)

//vetor de tiros
var tiros =[]

//criando vetor para armazenar os asteroides
var asteroides = []
for(var i = 0;i<N_OBJS;i++){
  asteroides.push(new Asteroide())
  Mundo.add(asteroides[i].getAsteroide())
}

//criando nave inimiga (nave coletavel)
var naveI = new Inimigo()
Mundo.add(naveI.getInimigo())

//efeito de nuvem para suavizar o fundo
Mundo.getScene().fog = new THREE.FogExp2(0x0000022, 0.00175)

//adicionando objetos ao mundo
Mundo.add(view)
Mundo.add(mapa.getMapa())

//---------------------------------eventos------------------------------------
window.addEventListener('keydown',
 function(e) {
   // nao utilizar o comando padra
   e.preventDefault()
    //pausar a musica
    if(e.keyCode == 77){//m
      var audio = document.getElementById("backgroundAudio");
      if(on){
        audio.pause();
        on=false
      }else{
        audio.play()
        on=true
      }
    }

    if(e.keyCode == 9){//tab
      if(miraOn){
        miraOn=false
        Mundo.remove(mira)
      }else{
        miraOn=true
        Mundo.add(mira)
      }

    }
}
)


window.addEventListener('keyup', function(e){ //para funcionar sÃ³ quando soltar o espaÃ§o
  switch (e.keyCode) {
    case 32: //espaaço

      var posicaoTiro = new THREE.Vector3(0,0,0)
      //copiar a posicao da camera
      posicaoTiro = view.position.clone()

      //subtraindo a posiÃ§Ã£o da nave em relaÃ§Ã£o a cÃ¢mera
      posicaoTiro.sub(new THREE.Vector3(0,25,80))

      var tiro = new Tiro(posicaoTiro)
      tiros.push(tiro)
      Mundo.add(tiro.getTiro())
      if(somTiro.paused){
        somTiro.play()
      }else {
        somTiro2.play()
      }
      break;
  }
})
